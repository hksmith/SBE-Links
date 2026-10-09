// accounts collection: one document per person / NFC card. _id === id.
const { db } = require('../db');

const strip = doc => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
};

module.exports = {
  async list() {
    return (await db.accounts.find({}).sort({ created: 1 }).toArray()).map(strip);
  },
  async get(id) {
    return strip(await db.accounts.findOne({ _id: String(id) }));
  },
  async bySlug(slug) {
    return strip(await db.accounts.findOne({ slug: String(slug) }));
  },
  async slugTaken(slug, exceptId) {
    const doc = await db.accounts.findOne({ slug });
    return !!doc && doc._id !== exceptId;
  },
  async insert(account) {
    await db.accounts.insertOne({ _id: account.id, ...account });
    return account;
  },
  async replace(account) {
    await db.accounts.replaceOne({ _id: account.id }, { _id: account.id, ...account });
    return account;
  },
  async remove(id) {
    await db.accounts.deleteOne({ _id: id });
  },
  async count() {
    return db.accounts.countDocuments({});
  },
};
