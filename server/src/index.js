// Entry point: connect to MongoDB, import old data if needed, start the HTTP server.
const http = require('http');
const config = require('./config');
const database = require('./db');
const auth = require('./services/auth');
const media = require('./services/media');
const { importLegacyIfEmpty } = require('./services/migrate');
const { createApp } = require('./app');

async function main() {
  try {
    await database.connect(config.mongoUri, config.mongoDbName);
  } catch (e) {
    console.error(`\nCould not connect to MongoDB at ${config.mongoUri}\n  ${e.message}\n` +
      'Start MongoDB (or set MONGODB_URI in server/.env to your MongoDB Atlas connection string) and try again.\n');
    process.exit(1);
  }
  await importLegacyIfEmpty(config.legacyDataFile);
  await auth.init();

  const server = http.createServer(createApp());
  server.listen(config.port, () => {
    console.log(`SBPO Link Tree running on http://localhost:${config.port}`);
    console.log(`  pages: /<slug>   NFC: /n/<slug>   API: /api/*   (the admin UI is the separate frontend/ app)`);
    if (config.clientOrigins.length) console.log(`  allowed frontend origin(s): ${config.clientOrigins.join(', ')}  (cookies: SameSite=${config.cookieSameSite})`);
    else console.warn('  CLIENT_ORIGIN is not set: browser frontends on other origins are not allowed and cross-site write protection is off.');
    if (config.generatedPassword) console.log(`  ADMIN_PASSWORD not set. Temporary password for "${config.adminUser}": ${config.adminPassword}`);
  });

  // Remove images nobody uses any more, a few times a day.
  setInterval(() => media.collectGarbage().catch(e => console.error('Media cleanup failed:', e.message)), 6 * 3600e3).unref();

  const shutdown = () => {
    setTimeout(() => process.exit(0), 3000).unref();
    server.close(() => database.close().finally(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
