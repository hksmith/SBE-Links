// accounts collection: one document per person / NFC card. _id === id.
//   company: id of the company the card belongs to (absent for individual cards). The page address (slug)
//   is unique among individual cards, and unique inside each company: /<slug> or /<company slug>/<slug>.
//   ownDesign: a company card normally uses the company's design; true = it has its own (theme).
//   fields: the person's details ({ phone, email, … }) used by {placeholders} in links and the automatic vCard.
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
  async listByCompany(companyId) {
    return (await db.accounts.find({ company: String(companyId) }).sort({ created: 1 }).toArray()).map(strip);
  },
  async bySlug(slug, company = null) {
    return strip(await db.accounts.findOne({ slug: String(slug), company: company == null ? null : String(company) }));
  },
  async slugTaken(slug, exceptId, company = null) {
    const doc = await db.accounts.findOne({ slug, company: company == null ? null : String(company) });
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
