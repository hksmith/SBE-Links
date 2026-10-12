// users collection: people who can sign in besides the built-in admin from .env. _id === username.
//   { _id, username, name, role: 'admin'|'viewer', accounts: 'all' | [accountId], salt, hash, ver, created }
// `ver` is part of every session cookie; bumping it (password change) signs out old sessions.
const { db } = require('../db');

const strip = doc => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
};

module.exports = {
  async list() {
    return (await db.users.find({}).sort({ created: 1 }).toArray()).map(strip);
  },
  async get(username) {
    return strip(await db.users.findOne({ _id: String(username) }));
  },
  async insert(user) {
    await db.users.insertOne({ _id: user.username, ...user });
    return user;
  },
  async update(username, fields) {
    await db.users.updateOne({ _id: username }, { $set: fields });
  },
  async remove(username) {
    await db.users.deleteOne({ _id: username });
  },
};
