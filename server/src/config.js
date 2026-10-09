// Central configuration. Values come from environment variables, optionally loaded from server/.env
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

// Minimal .env loader (KEY=value per line, # comments). Real env vars always win.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnvFile(path.join(ROOT, '.env'));

const env = process.env;
let adminPassword = env.ADMIN_PASSWORD;
const generatedPassword = !adminPassword;
if (!adminPassword) adminPassword = crypto.randomBytes(6).toString('hex');

module.exports = {
  port: Number(env.PORT) || 3000,
  mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sbpo-link-tree',
  mongoDbName: env.MONGODB_DB || undefined, // defaults to the database named in the URI
  adminUser: env.ADMIN_USER || 'admin',
  adminPassword,
  generatedPassword,
  trustProxy: !!env.TRUST_PROXY,
  // Old single-file database. Imported automatically the first time the MongoDB database is empty.
  legacyDataFile: env.LEGACY_DATA_FILE || path.join(ROOT, 'data', 'legacy-data.json'),
  clientDir: path.resolve(ROOT, '..', 'client'),
};
