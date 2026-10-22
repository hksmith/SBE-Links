// events collection: raw page views and link clicks.
//   { t: timestamp, k: 'view'|'click', a: accountId, id?: linkId, title?: linkTitle, src, dev }
// stats collection: running totals per account so the dashboard never has to scan every event.
//   { _id: accountId, views, taps, clicks, last, byLink: {linkId: n}, dev: {Desktop: n}, src: {nfc: n} }
const { db } = require('../db');

const key = s => String(s).replace(/[.$]/g, '_'); // MongoDB field names cannot contain "." or start with "$"

function statUpdate(e) {
  const inc = {};
  if (e.k === 'click') {
    inc.clicks = 1;
    inc[`byLink.${key(e.id)}`] = 1;
  } else {
    inc.views = 1;
    if (e.src === 'nfc') inc.taps = 1;
    inc[`src.${key(e.src)}`] = 1;
    inc[`dev.${key(e.dev)}`] = 1;
  }
  return { $inc: inc, $max: { last: e.t } };
}

module.exports = {
  statUpdate,
  async record(e) {
    await db.events.insertOne({ ...e });
    await db.stats.updateOne({ _id: e.a }, statUpdate(e), { upsert: true });
  },
  async since(accountId, t) {
    return db.events.find({ a: accountId, t: { $gte: t } }, { projection: { _id: 0, t: 1, k: 1 } }).toArray();
  },
  async recentClicks(accountId, limit) {
    return db.events.find({ a: accountId, k: 'click' }, { projection: { _id: 0 } }).sort({ t: -1 }).limit(limit).toArray();
  },
  async sinceMany(ids, t) {
    return db.events.find({ a: { $in: ids }, t: { $gte: t } }, { projection: { _id: 0, t: 1, k: 1 } }).toArray();
  },
  async recentClicksMany(ids, limit) {
    return db.events.find({ a: { $in: ids }, k: 'click' }, { projection: { _id: 0 } }).sort({ t: -1 }).limit(limit).toArray();
  },
  // Dashboard: every view / tap / click of these pages since t, and the latest of them.
  async activitySince(ids, t) {
    return db.events.find({ a: { $in: ids }, t: { $gte: t } }, { projection: { _id: 0, t: 1, k: 1, src: 1 } }).toArray();
  },
  async recentMany(ids, limit) {
    return db.events.find({ a: { $in: ids } }, { projection: { _id: 0 } }).sort({ t: -1 }).limit(limit).toArray();
  },
  async totals() {
    return db.stats.find({}).toArray();
  },
  async totalsFor(accountId) {
    return db.stats.findOne({ _id: accountId });
  },
  // Statistics back to zero for these pages (their events and running totals). Returns how many events were removed.
  async clearMany(ids) {
    const r = await db.events.deleteMany({ a: { $in: ids } });
    for (const id of ids) await db.stats.deleteOne({ _id: id });
    return r.deletedCount || 0;
  },
  async removeFor(accountId) {
    await db.events.deleteMany({ a: accountId });
    await db.stats.deleteOne({ _id: accountId });
  },
};
