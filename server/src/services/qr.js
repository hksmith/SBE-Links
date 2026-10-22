// QR codes: validation, who-scanned details, statistics and the small pages a scan can show.
const crypto = require('crypto');
const repo = require('../repositories/qrcodes');
const { S, safeUrl } = require('./sanitize');

const TYPES = ['link', 'file', 'text'];
const SHAPES = ['square', 'rounded', 'dots'];
const CODE = /^[a-z0-9][a-z0-9-]{1,31}$/;
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/o, 1/l/i: easy to read out or type
const MAX_FILE = 10 * 1024 * 1024;
const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
const MEDIA_URL = /^\/media\/[a-f0-9]{32}$/;

const randomCode = (n = 6) => [...crypto.randomBytes(n)].map(b => ALPHABET[b % ALPHABET.length]).join('');

async function freeCode() {
  for (let n = 6; ; n++) for (let i = 0; i < 5; i++) { const c = randomCode(n); if (!(await repo.codeTaken(c))) return c; }
}

// Cleans what the admin app sends. Returns { error } or the fields to save.
function clean(b, old = {}) {
  const q = {
    name: S(b.name ?? old.name, 120).trim(),
    note: S(b.note ?? old.note ?? '', 500).trim(),
    type: TYPES.includes(b.type) ? b.type : old.type || 'link',
    url: b.url !== undefined ? safeUrl(b.url) : old.url || '',
    text: S(b.text ?? old.text ?? '', 5000),
    active: b.active !== undefined ? b.active !== false : old.active !== false,
    style: {
      fg: hex(b.style && b.style.fg, (old.style && old.style.fg) || '#111111'),
      bg: hex(b.style && b.style.bg, (old.style && old.style.bg) || '#ffffff'),
      shape: SHAPES.includes(b.style && b.style.shape) ? b.style.shape : (old.style && old.style.shape) || 'square',
      logo: b.style && 'logo' in b.style ? (MEDIA_URL.test(b.style.logo) ? b.style.logo : '') : (old.style && old.style.logo) || '',
    },
  };
  if (!q.name) return { error: 'name', message: 'Please give the QR code a name.' };
  if (q.type === 'link' && !q.url) return { error: 'url', message: 'Please enter the link the QR code should open.' };
  if (q.type === 'text' && !q.text.trim()) return { error: 'text', message: 'Please enter the text to show.' };
  return q;
}

/* ---------- who scanned ---------- */

function parseAgent(ua) {
  const os = /iphone|ipad|ipod|ios/i.test(ua) ? 'iOS' : /android/i.test(ua) ? 'Android' : /windows/i.test(ua) ? 'Windows'
    : /mac os|macintosh/i.test(ua) ? 'macOS' : /cros/i.test(ua) ? 'ChromeOS' : /linux/i.test(ua) ? 'Linux' : 'Other';
  const dev = /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? 'Tablet' : /mobi|iphone|ipod|android/i.test(ua) ? 'Phone' : 'Computer';
  const br = /telegram/i.test(ua) ? 'Telegram' : /fban|fbav|fb_iab/i.test(ua) ? 'Facebook' : /instagram/i.test(ua) ? 'Instagram'
    : /whatsapp/i.test(ua) ? 'WhatsApp' : /samsungbrowser/i.test(ua) ? 'Samsung Internet' : /edg\//i.test(ua) ? 'Edge'
      : /opr\/|opera/i.test(ua) ? 'Opera' : /firefox|fxios/i.test(ua) ? 'Firefox' : /crios|chrome/i.test(ua) ? 'Chrome'
        : /safari/i.test(ua) ? 'Safari' : 'Other';
  return { os, dev, br };
}

const firstIp = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
const header = (req, ...names) => { for (const n of names) { const v = req.headers[n]; if (v) return decodeURIComponent(String(v)).slice(0, 60); } return ''; };

// Everything recorded about one scan. The visitor is a one-way hash (no IP address is stored),
// used only to tell first-time scanners from people scanning again.
function scanInfo(req, secret) {
  const ua = String(req.headers['user-agent'] || '');
  const ip = firstIp(req);
  const cc = header(req, 'x-vercel-ip-country', 'cf-ipcountry', 'x-country-code', 'x-appengine-country').toUpperCase().slice(0, 2);
  const city = header(req, 'x-vercel-ip-city', 'cf-ipcity', 'x-appengine-city');
  const lang = String(req.headers['accept-language'] || '').split(/[,;]/)[0].trim().slice(0, 12) || 'Unknown';
  let ref = '';
  try { ref = req.headers.referer ? new URL(req.headers.referer).hostname.slice(0, 80) : ''; } catch { /* ignore */ }
  return {
    t: Date.now(),
    v: crypto.createHmac('sha256', String(secret || 'qr')).update(ip + '|' + ua).digest('hex').slice(0, 20),
    ...parseAgent(ua), cc: cc && cc !== 'XX' ? cc : 'Unknown', city, lang, ref,
  };
}

/* ---------- statistics ---------- */

// tz = the admin's offset from UTC in minutes, so days and hours are in their own time.
async function detail(q, tz = 0) {
  const off = Math.max(-840, Math.min(840, Number(tz) || 0)) * 6e4;
  const local = t => new Date(t + off);
  const dayOf = t => local(t).toISOString().slice(0, 10);
  const now = Date.now();
  const days = [...Array(30)].map((_, i) => dayOf(now - (29 - i) * 864e5));
  const idx = Object.fromEntries(days.map((d, i) => [d, i]));
  const buckets = days.map(d => ({ d, n: 0, u: new Set(), nw: 0 }));
  const hours = Array(24).fill(0), week = Array(7).fill(0);
  const start = Date.parse(days[0] + 'T00:00:00Z') - off;
  let today = 0, last7 = 0;
  const todayKey = dayOf(now), weekStart = Date.parse(days[23] + 'T00:00:00Z') - off;
  for (const s of await repo.scansSince(q.id, start)) {
    const i = idx[dayOf(s.t)];
    if (i == null) continue;
    const b = buckets[i];
    b.n++; b.u.add(s.v); if (s.nw) b.nw++;
    hours[local(s.t).getUTCHours()]++;
    week[local(s.t).getUTCDay()]++;
    if (dayOf(s.t) === todayKey) today++;
    if (s.t >= weekStart) last7++;
  }
  const st = q.st || {};
  return {
    scans: st.scans || 0, unique: st.unique || 0, last: st.last || 0, first: await repo.firstScan(q.id),
    today, last7, last30: buckets.reduce((a, b) => a + b.n, 0),
    days: buckets.map(b => ({ d: b.d, n: b.n, u: b.u.size, nw: b.nw })),
    hours, week,
    dev: st.dev || {}, os: st.os || {}, br: st.br || {}, cc: st.cc || {}, lang: st.lang || {},
    recent: await repo.recentScans(q.id, 25),
  };
}

// What the QR list shows about each code.
const summary = q => ({
  id: q.id, code: q.code, name: q.name, note: q.note || '', type: q.type, active: q.active !== false,
  url: q.type === 'link' ? q.url : '', file: q.type === 'file' ? q.file || null : null,
  text: q.type === 'text' ? q.text.slice(0, 140) : '', style: q.style, created: q.created, updated: q.updated || q.created,
  scans: (q.st && q.st.scans) || 0, unique: (q.st && q.st.unique) || 0, last: (q.st && q.st.last) || 0,
});

/* ---------- pages shown to the person who scanned ---------- */

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const linkify = s => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" rel="noopener">$1</a>');

function footer(brand) {
  if (!brand || (!brand.text && !brand.logo)) return '';
  return `<footer>${brand.text ? `<span>${esc(brand.text)}</span>` : ''}${brand.logo ? `<img src="${esc(brand.logo)}" alt="" style="height:${+brand.logoSize || 18}px">` : ''}</footer>`;
}

function page(title, body, brand) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex">
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 18px;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#162038;background:#f2f5fb}
main{width:100%;max-width:640px;background:#fff;border-radius:18px;padding:26px 24px;box-shadow:0 10px 30px rgba(20,32,70,.08)}
h1{font-size:20px;margin:0 0 12px}.tx{white-space:pre-wrap;word-wrap:break-word;margin:0}.mut{color:#66728c;margin:0}a{color:#4f46e5}
footer{display:flex;gap:8px;align-items:center;justify-content:center;margin-top:22px;color:#66728c;font-size:13px}footer img{max-width:120px;object-fit:contain}</style>
</head><body><main>${body}</main>${footer(brand)}</body></html>`;
}

const textPage = (q, brand) => page(q.name, `<h1>${esc(q.name)}</h1><p class="tx">${linkify(q.text)}</p>`, brand);
const pausedPage = brand => page('Not available', '<h1>This QR code is not active</h1><p class="mut">It has been paused. Please check back later.</p>', brand);
const missingPage = brand => page('Not found', '<h1>QR code not found</h1><p class="mut">This QR code doesn’t exist or has been removed.</p>', brand);

// Files a phone can show by itself open in the browser; anything else is downloaded.
const INLINE = /^(image\/|video\/|audio\/|text\/plain|application\/pdf)/;
function sendQrFile(req, res, f) {
  const disp = `${INLINE.test(f.type) ? 'inline' : 'attachment'}; filename="${f.name.replace(/[^\w.-]+/g, '_')}"; filename*=UTF-8''${encodeURIComponent(f.name)}`;
  const head = { 'Content-Type': f.type || 'application/octet-stream', 'Content-Disposition': disp, 'Cache-Control': 'private, no-cache', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  if (m && (m[1] || m[2])) { // videos on iPhone need byte ranges
    const size = f.data.length;
    let a = m[1] ? +m[1] : size - +m[2], b = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
    if (a < 0) a = 0;
    if (a > b || a >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { ...head, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1 });
    return res.end(req.method === 'HEAD' ? undefined : f.data.subarray(a, b + 1));
  }
  res.writeHead(200, { ...head, 'Content-Length': f.data.length });
  res.end(req.method === 'HEAD' ? undefined : f.data);
}

module.exports = { TYPES, CODE, MAX_FILE, randomCode, freeCode, clean, parseAgent, scanInfo, detail, summary, textPage, pausedPage, missingPage, sendQrFile };
