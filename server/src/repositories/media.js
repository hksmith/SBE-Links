// media collection: uploaded images (profile photos, logos, gallery images, icons).
// Content-addressed: _id is a hash of the bytes, so the same image is only ever stored once.
//   { _id, type: 'image/png', data: Binary, size, created }
const crypto = require('crypto');
const { db } = require('../db');

// The driver returns a BSON Binary; normalise it (or a plain Uint8Array) to a Buffer.
const toBuffer = d => {
  if (Buffer.isBuffer(d)) return d;
  const u = d instanceof Uint8Array ? d : typeof d.length === 'function' ? d.buffer.subarray(0, d.length()) : d.buffer;
  return Buffer.from(u.buffer, u.byteOffset, u.byteLength);
};

module.exports = {
  async put(buffer, type) {
    const id = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32);
    await db.media.updateOne(
      { _id: id },
      { $setOnInsert: { type, data: buffer, size: buffer.length, created: Date.now() } },
      { upsert: true },
    );
    return id;
  },
  async get(id) {
    const doc = await db.media.findOne({ _id: String(id) });
    return doc ? { type: doc.type, data: toBuffer(doc.data) } : null;
  },
  async removeUnreferenced(keepIds, olderThan) {
    const r = await db.media.deleteMany({ _id: { $nin: [...keepIds] }, created: { $lt: olderThan } });
    return r.deletedCount || 0;
  },
};
