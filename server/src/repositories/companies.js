// companies collection: one document per company. _id === id.
//   { id, slug, name, created,
//     theme,                       the shared design of the company page and every card that doesn't have its own
//     page:     { profile, fields, blocks }   the company page at /<slug>: logo (centered), name, tagline, about,
//                                             company details (fields) and links. Its logo is the logo of every card.
//     template: { profile, fields, blocks }   the starting card for new people: links with {placeholders},
//                                             sample details for the preview, default department / company / bio
//     showTeam                     list the people on the company page }
const { db } = require('../db');

const strip = doc => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
};

module.exports = {
  async list() {
    return (await db.companies.find({}).sort({ created: 1 }).toArray()).map(strip);
  },
  async get(id) {
    return strip(await db.companies.findOne({ _id: String(id) }));
  },
  async bySlug(slug) {
    return strip(await db.companies.findOne({ slug: String(slug) }));
  },
  async slugTaken(slug, exceptId) {
    const doc = await db.companies.findOne({ slug });
    return !!doc && doc._id !== exceptId;
  },
  async insert(c) {
    await db.companies.insertOne({ _id: c.id, ...c });
    return c;
  },
  async replace(c) {
    await db.companies.replaceOne({ _id: c.id }, { _id: c.id, ...c });
    return c;
  },
  async remove(id) {
    await db.companies.deleteOne({ _id: id });
  },
};
