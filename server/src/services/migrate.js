// One-time import of the old single-file database (data.json) into MongoDB.
const fs = require('fs');
const { db } = require('../db');
const accountsRepo = require('../repositories/accounts');
const settings = require('../repositories/settings');
const { statUpdate } = require('../repositories/events');
const { clean, slugify, validSlug } = require('./sanitize');
const media = require('./media');

async function importLegacy(file, { log = console.log } = {}) {
  const D = JSON.parse(fs.readFileSync(file, 'utf8') || '{}');
  const accounts = D.accounts || [], events = D.events || [];

  if (D.secret) await settings.set('secret', D.secret); // keeps existing admin sessions valid
  if (D.brand && D.brand.logo) await settings.set('brand', { logo: await media.store(D.brand.logo) });

  let n = 0;
  for (const raw of accounts) {
    if (await accountsRepo.get(raw.id)) continue;
    const a = clean(raw, { id: raw.id, slug: validSlug(raw.slug) ? raw.slug : slugify(raw.profile && raw.profile.name) || 'card-' + raw.id, created: raw.created || Date.now() });
    if (await accountsRepo.slugTaken(a.slug, a.id)) a.slug = `${a.slug}-${a.id}`;
    await media.ingestAccount(a);
    await accountsRepo.insert(a);
    n++;
  }

  const known = new Set(accounts.map(a => a.id));
  const valid = events.filter(e => known.has(e.a) && e.t && (e.k === 'view' || e.k === 'click'));
  for (let i = 0; i < valid.length; i += 1000) await db.events.insertMany(valid.slice(i, i + 1000).map(e => ({ ...e })));
  // Fold all events into one $inc / $max update per account.
  const per = {};
  for (const e of valid) {
    const u = statUpdate(e), acc = per[e.a] || (per[e.a] = { $inc: {}, $max: { last: 0 } });
    for (const [k, v] of Object.entries(u.$inc)) acc.$inc[k] = (acc.$inc[k] || 0) + v;
    acc.$max.last = Math.max(acc.$max.last, u.$max.last);
  }
  for (const [id, u] of Object.entries(per)) await db.stats.updateOne({ _id: id }, u, { upsert: true });

  log(`Imported ${n} account(s) and ${valid.length} event(s) from ${file}`);
  return { accounts: n, events: valid.length };
}

// Runs on boot: only imports when MongoDB has no accounts yet and the legacy file exists.
async function importLegacyIfEmpty(file) {
  if (!file || !fs.existsSync(file) || (await accountsRepo.count()) > 0) return null;
  console.log('MongoDB is empty — importing existing data from', file);
  return importLegacy(file);
}

module.exports = { importLegacy, importLegacyIfEmpty };
