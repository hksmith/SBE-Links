// Holds the MongoDB collections used by the repositories.
// `connect()` opens the real database; tests call `use()` with in-memory stand-ins.
const COLLECTIONS = ['accounts', 'events', 'stats', 'media', 'settings', 'users'];
const db = {};
let client = null;

function use(collections) {
  for (const name of COLLECTIONS) {
    if (!collections[name]) throw new Error(`Missing collection: ${name}`);
    db[name] = collections[name];
  }
  return db;
}

async function connect(uri, dbName) {
  const { MongoClient } = require('mongodb');
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const database = client.db(dbName);
  use(Object.fromEntries(COLLECTIONS.map(n => [n, database.collection(n)])));
  await ensureIndexes();
  return db;
}

async function ensureIndexes() {
  await db.accounts.createIndex({ slug: 1 }, { unique: true });
  await db.events.createIndex({ a: 1, t: -1 });
  await db.events.createIndex({ a: 1, k: 1, t: -1 });
  await db.media.createIndex({ created: 1 });
  await db.users.createIndex({ created: 1 });
}

async function close() {
  if (client) await client.close();
  client = null;
}

module.exports = { db, use, connect, close, ensureIndexes };
