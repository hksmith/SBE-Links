// QR codes (internal tool, admins only).
//   Admin API:  /api/qr…            list, create, edit, pause, delete, upload files, statistics, Excel export
//   Public:     /q/<code>           what the printed QR code holds: records the scan, then opens the link,
//                                   shows the file (PDF, photo, video, any document) or shows the text
const crypto = require('crypto');
const repo = require('../repositories/qrcodes');
const settings = require('../repositories/settings');
const qr = require('../services/qr');
const stats = require('../services/stats');
const brand = require('../services/brand');
const xlsx = require('../services/xlsx');
const { json, html, redirect, readJson, readRaw, sendFile } = require('../lib/http');

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
let secret = null;
const visitorSecret = async () => (secret ??= (await settings.get('secret')) || 'qr');

// File details the admin app sent back after an upload; only files that really exist are accepted.
async function checkFile(f) {
  if (!f || typeof f.id !== 'string' || !/^[a-f0-9]{32}$/.test(f.id)) return null;
  const doc = await repo.getFile(f.id);
  return doc ? { id: f.id, name: doc.name, type: doc.type, size: doc.size } : null;
}

const fail = (res, r, status = 400) => json(res, { error: r.error, message: r.message }, status);

function forAdmins(router) {
  router.get('/api/qr', async (req, res) => json(res, (await repo.list()).map(qr.summary)));

  // Upload the file a QR code opens: the raw bytes in the body, the file name in X-File-Name.
  router.post('/api/qr/files', async (req, res) => {
    let name = 'file';
    try { name = decodeURIComponent(String(req.headers['x-file-name'] || 'file')); } catch { /* keep default */ }
    name = name.replace(/[\\/\0\r\n"]/g, '_').slice(0, 140) || 'file';
    const type = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim().slice(0, 100) || 'application/octet-stream';
    const data = await readRaw(req, qr.MAX_FILE);
    if (!data) return json(res, { error: 'size', message: `The file is too large. The limit is ${qr.MAX_FILE / 1048576} MB.` }, 413);
    if (!data.length) return json(res, { error: 'empty', message: 'That file is empty.' }, 400);
    json(res, await repo.putFile({ name, type, data }), 201);
  });

  router.post('/api/qr', async (req, res) => {
    const b = (await readJson(req, 1e5)) || {};
    const q = qr.clean(b);
    if (q.error) return fail(res, q);
    q.file = q.type === 'file' ? await checkFile(b.file) : null;
    if (q.type === 'file' && !q.file) return fail(res, { error: 'file', message: 'Please choose the file the QR code should open.' });
    let code = String(b.code || '').trim().toLowerCase();
    if (code) {
      if (!qr.CODE.test(code)) return fail(res, { error: 'code', message: 'Short code: 2–32 letters, numbers or dashes.' });
      if (await repo.codeTaken(code)) return fail(res, { error: 'code', message: 'That short code is already used by another QR code.' }, 409);
    } else code = await qr.freeCode();
    const now = Date.now();
    const doc = { id: crypto.randomBytes(6).toString('hex'), code, ...q, created: now, updated: now, st: { scans: 0, unique: 0, last: 0 } };
    try { await repo.insert(doc); } catch (e) {
      if (e && e.code === 11000) return fail(res, { error: 'code', message: 'That short code is already used by another QR code.' }, 409);
      throw e;
    }
    json(res, qr.summary(doc), 201);
  });

  router.get('/api/qr/:id', async (req, res, { params, url }) => {
    const q = await repo.get(params.id);
    if (!q) return json(res, { error: 'nf', message: 'That QR code was not found.' }, 404);
    json(res, { ...qr.summary(q), text: q.text || '', stats: await qr.detail(q, url.searchParams.get('tz')) });
  });

  router.put('/api/qr/:id', async (req, res, { params }) => {
    const old = await repo.get(params.id);
    if (!old) return json(res, { error: 'nf', message: 'That QR code was not found.' }, 404);
    const b = (await readJson(req, 1e5)) || {};
    const q = qr.clean(b, old);
    if (q.error) return fail(res, q);
    q.file = q.type === 'file' ? ('file' in b ? await checkFile(b.file) : old.file || null) : null;
    if (q.type === 'file' && !q.file) return fail(res, { error: 'file', message: 'Please choose the file the QR code should open.' });
    q.updated = Date.now();
    await repo.update(old.id, q);
    if (old.file && (!q.file || q.file.id !== old.file.id)) await repo.removeFile(old.file.id); // replaced or no longer a file
    json(res, qr.summary({ ...old, ...q }));
  });

  router.delete('/api/qr/:id', async (req, res, { params }) => {
    const q = await repo.get(params.id);
    if (!q) return json(res, { error: 'nf' }, 404);
    await repo.remove(q.id);
    if (q.file) await repo.removeFile(q.file.id);
    json(res, { ok: true });
  });

  // Start counting from zero (e.g. after testing the code yourself).
  router.post('/api/qr/:id/reset', async (req, res, { params }) => {
    const q = await repo.get(params.id);
    if (!q) return json(res, { error: 'nf' }, 404);
    await repo.clearScans(q.id);
    json(res, { ok: true });
  });

  // Every scan as an Excel file. tz = the admin's offset from UTC in minutes, so times are in their own time.
  router.get('/api/qr/:id/scans.xlsx', async (req, res, { params, url }) => {
    const q = await repo.get(params.id);
    if (!q) return json(res, { error: 'nf' }, 404);
    const off = (Number(url.searchParams.get('tz')) || 0) * 6e4;
    const when = t => new Date(t + off).toISOString().replace('T', ' ').slice(0, 19);
    const rows = [['Date & time', 'First scan by this visitor', 'Device', 'System', 'Browser / app', 'Country', 'City', 'Language', 'Came from']];
    for (const s of await repo.allScans(q.id)) rows.push([when(s.t), s.nw ? 'Yes' : 'No', s.dev, s.os, s.br, s.cc, s.city || '', s.lang, s.ref || '']);
    const buf = xlsx.write([{ name: 'Scans', rows, widths: [20, 12, 11, 11, 16, 9, 16, 10, 22] }]);
    sendFile(res, buf, `${q.name || q.code}-scans.xlsx`, XLSX);
  });
}

function forPublic(router) {
  const open = async (req, res, { params }) => {
    const b = await brand.get();
    const q = await repo.byCode(params.code);
    if (!q) return html(res, qr.missingPage(b), 404);
    if (q.active === false) return html(res, qr.pausedPage(b));
    const ua = String(req.headers['user-agent'] || '');
    const range = String(req.headers.range || '');
    // Only real visits count: not link-preview bots, not HEAD requests, not the later pieces of a video.
    if (req.method === 'GET' && !stats.BOT.test(ua) && (!range || /^bytes=0-/.test(range))) {
      repo.recordScan(q.id, qr.scanInfo(req, await visitorSecret())).catch(e => console.error('Could not record scan:', e.message));
    }
    if (q.type === 'link') return redirect(res, q.url);
    if (q.type === 'text') return html(res, qr.textPage(q, b));
    const f = q.file && (await repo.getFile(q.file.id));
    if (!f) return html(res, qr.missingPage(b), 404);
    return qr.sendQrFile(req, res, f);
  };
  router.get('/q/:code', open);
  router.get('/q/:code/:name', open); // same, with the file name in the address (nicer when saved)
}

module.exports = { forAdmins, forPublic };
