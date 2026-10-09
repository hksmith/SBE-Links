// Import an old data.json into MongoDB:  npm run migrate -- path/to/data.json
// Accounts that already exist (same id) are skipped, so it is safe to run more than once.
const path = require('path');
const config = require('../src/config');
const database = require('../src/db');
const { importLegacy } = require('../src/services/migrate');

(async () => {
  const file = path.resolve(process.argv[2] || config.legacyDataFile);
  await database.connect(config.mongoUri, config.mongoDbName);
  try {
    await importLegacy(file);
  } finally {
    await database.close();
  }
})().catch(e => { console.error(e.message); process.exit(1); });
