// QR codes (admin only, internal use).
//
// qrcodes collection: one document per QR code. _id === id.
//   { _id, code, name, note, type: 'link'|'file'|'text', url, text, file: { id, name, type, size } | null,
//     active, style: { fg, bg, shape, logo }, created, updated,
//     st: { scans, unique, last, first, dev: {Phone: n}, os: {iOS: n}, br: {Safari: n}, cc: {ET: n}, lang: {en: n} } }
//   The printed QR always holds <site>/q/<code>, so what it opens can be changed later without reprinting.
//
// scans collection: one document per scan.
//   { q: qrId, t, v: visitor hash, nw: first scan by this visitor, dev, os, br, cc, city, lang, ref }
//
// qrfiles collection: files a QR code opens (PDF, images, documents, anything).
//   { _id, name, type, size, data: Binary, created }
const crypto = require('crypto');
const { db } = require('../db');

const strip = doc => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
};
const key = s => String(s || 'Unknown').replace(/[.$]/g, '_').slice(0, 40) || 'Unknown'; // MongoDB field names

// The driver returns a BSON Binary; normalise it (or a plain Uint8Array) to a Buffer.
const toBuffer = d => {
  if (Buffer.isBuffer(d)) return d;
  const u = d instanceof Uint8Array ? d : typeof d.length === 'function' ? d.buffer.subarray(0, d.length()) : d.buffer;
  return Buffer.from(u.buffer, u.byteOffset, u.byteLength);
};

const DIMENSIONS = ['dev', 'os', 'br', 'cc', 'lang'];
// Two hits from the same phone this close together are one scan (camera apps and PDF/video viewers often load twice).
const SAME_SCAN_MS = 10e3;

module.exports = {
  DIMENSIONS,

  async list() {
    return (await db.qrcodes.find({}).sort({ created: -1 }).toArray()).map(strip);
  },
  async get(id) {
    return strip(await db.qrcodes.findOne({ _id: String(id) }));
  },
  async byCode(code) {
    return strip(await db.qrcodes.findOne({ code: String(code).toLowerCase() }));
  },
  async codeTaken(code, exceptId) {
    const d = await db.qrcodes.findOne({ code });
    return !!d && d._id !== exceptId;
  },
  async insert(q) {
    const { id, ...rest } = q;
    await db.qrcodes.insertOne({ _id: id, ...rest });
  },
  async update(id, fields) {
    await db.qrcodes.updateOne({ _id: String(id) }, { $set: fields });
  },
  async remove(id) {
    await db.qrcodes.deleteOne({ _id: String(id) });
    await db.scans.deleteMany({ q: String(id) });
  },

  /* ---------- scans ---------- */

  // Records one scan. Returns false when it was a repeat of the same visitor's scan a moment ago.
  async recordScan(qrId, e) {
    if (await db.scans.findOne({ q: qrId, v: e.v, t: { $gte: e.t - SAME_SCAN_MS, $lte: e.t } })) return false;
    const nw = !(await db.scans.findOne({ q: qrId, v: e.v }));
    await db.scans.insertOne({ q: qrId, ...e, nw });
    const inc = { 'st.scans': 1 };
    if (nw) inc['st.unique'] = 1;
    for (const d of DIMENSIONS) inc[`st.${d}.${key(e[d])}`] = 1;
    await db.qrcodes.updateOne({ _id: qrId }, { $inc: inc, $max: { 'st.last': e.t } });
    return true;
  },
  async scansSince(qrId, t) {
    return db.scans.find({ q: qrId, t: { $gte: t } }, { projection: { _id: 0, t: 1, v: 1, nw: 1 } }).toArray();
  },
  async recentScans(qrId, limit) {
    return db.scans.find({ q: qrId }, { projection: { _id: 0, q: 0, v: 0 } }).sort({ t: -1 }).limit(limit).toArray();
  },
  async allScans(qrId) {
    return db.scans.find({ q: qrId }, { projection: { _id: 0, q: 0 } }).sort({ t: -1 }).toArray();
  },
  async firstScan(qrId) {
    const [s] = await db.scans.find({ q: qrId }, { projection: { _id: 0, t: 1 } }).sort({ t: 1 }).limit(1).toArray();
    return s ? s.t : 0;
  },
  async clearScans(qrId) {
    await db.scans.deleteMany({ q: String(qrId) });
    await db.qrcodes.updateOne({ _id: String(qrId) }, { $set: { st: { scans: 0, unique: 0, last: 0 } } });
  },

  /* ---------- files ---------- */

  async putFile({ name, type, data }) {
    const id = crypto.randomBytes(16).toString('hex');
    await db.qrfiles.insertOne({ _id: id, name, type, size: data.length, data, created: Date.now() });
    return { id, name, type, size: data.length };
  },
  async getFile(id) {
    const d = await db.qrfiles.findOne({ _id: String(id) });
    return d ? { name: d.name, type: d.type, size: d.size, data: toBuffer(d.data) } : null;
  },
  async removeFile(id) {
    await db.qrfiles.deleteOne({ _id: String(id) });
  },
  // Uploaded files no QR code uses (e.g. uploaded, then the dialog was cancelled). Fresh uploads are kept for a while.
  async removeUnusedFiles(olderThan = Date.now() - 24 * 3600e3) {
    const keep = (await db.qrcodes.find({}).toArray()).map(q => q.file && q.file.id).filter(Boolean);
    const r = await db.qrfiles.deleteMany({ _id: { $nin: keep }, created: { $lt: olderThan } });
    return r.deletedCount || 0;
  },
};
