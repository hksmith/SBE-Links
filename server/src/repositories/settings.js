// settings collection: small key/value documents ({ _id: key, value }).
// Keys in use: "brand" ({ logo }), "secret" (HMAC key for admin sessions).
const { db } = require('../db');

module.exports = {
  async get(key, fallback = null) {
    const doc = await db.settings.findOne({ _id: key });
    return doc ? doc.value : fallback;
  },
  async set(key, value) {
    await db.settings.updateOne({ _id: key }, { $set: { value } }, { upsert: true });
    return value;
  },
};
