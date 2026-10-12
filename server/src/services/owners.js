// View-only logins for card owners.
// Every card can get one login whose username is the card's page address and whose password is the shared
// first-time password (DEFAULT_USER_PASSWORD). It can only see that card's statistics, and the person must
// choose their own password the first time they sign in.
const config = require('../config');
const auth = require('./auth');
const usersRepo = require('../repositories/users');
const accounts = require('../repositories/accounts');
const settings = require('../repositories/settings');
const companies = require('../repositories/companies');

const USERNAME = /^[a-z0-9._-]{3,32}$/;

// Turns a page address into a free username: "yiha-yimam", or "yiha-yimam-2" when that is taken.
async function freeUsername(slug) {
  let base = String(slug || 'card').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, 28).replace(/^-+|-+$/g, '') || 'card';
  if (base.length < 3) base = (base + '-card').slice(0, 28);
  const taken = async n => n === config.adminUser.toLowerCase() || !!(await usersRepo.get(n));
  let name = base;
  for (let i = 2; !USERNAME.test(name) || (await taken(name)); i++) name = `${base}-${i}`;
  return name;
}

// Creates the login for one card. Resolves to { username, password }.
// Cards of a company get "<company>.<card>" usernames, e.g. acme.yiha-yimam.
async function createFor(account, company) {
  if (account.company && !company) company = await companies.get(account.company);
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = await freeUsername(company ? `${company.slug}.${account.slug}` : account.slug);
    const u = {
      username, name: (account.profile && account.profile.name) || username, role: 'viewer', accounts: [account.id],
      owner: account.id, mustChange: true, ...auth.hashPassword(config.defaultUserPassword), ver: 0, created: Date.now(),
    };
    try {
      await usersRepo.insert(u);
      return { username, password: config.defaultUserPassword };
    } catch (e) {
      if (!(e && e.code === 11000)) throw e; // username taken by a parallel request: try the next one
    }
  }
  throw new Error('Could not find a free username');
}

// Puts a user back on the shared first-time password; signs them out everywhere.
async function resetToDefault(u) {
  await usersRepo.update(u.username, { ...auth.hashPassword(config.defaultUserPassword), mustChange: true, ver: (u.ver || 0) + 1 });
  return { username: u.username, password: config.defaultUserPassword };
}

// Creates a login for every card that doesn't have one. Returns [{ name, slug, username, password }].
async function createMissing() {
  const [list, users] = await Promise.all([accounts.list(), usersRepo.list()]);
  const has = new Set(users.map(u => u.owner).filter(Boolean));
  const created = [];
  for (const a of list) {
    if (has.has(a.id)) continue;
    created.push({ name: a.profile.name, slug: a.slug, ...(await createFor(a)) });
  }
  return created;
}

// Runs once (on the first start with this feature): gives every existing card its owner login automatically.
// Only once, so a login an admin deleted on purpose is not brought back on the next restart.
async function backfillOnce() {
  if (await settings.get('ownerLoginsBackfilled')) return 0;
  const made = await createMissing();
  await settings.set('ownerLoginsBackfilled', Date.now());
  return made.length;
}

// What the admin dashboard shows for each card's login, by account id.
async function loginsByAccount() {
  const out = {};
  for (const u of await usersRepo.list()) {
    if (!u.owner) continue;
    out[u.owner] = { username: u.username, mustChange: !!u.mustChange, ...(u.mustChange ? { password: config.defaultUserPassword } : {}) };
  }
  return out;
}

// The company admin: sees the totals of the whole company and every card of it, nothing else.
async function createCompanyAdmin(company) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = await freeUsername(company.slug);
    const u = {
      username, name: `${company.name} (company admin)`, role: 'viewer', accounts: [], company: company.id,
      mustChange: true, ...auth.hashPassword(config.defaultUserPassword), ver: 0, created: Date.now(),
    };
    try {
      await usersRepo.insert(u);
      return { username, password: config.defaultUserPassword };
    } catch (e) {
      if (!(e && e.code === 11000)) throw e;
    }
  }
  throw new Error('Could not find a free username');
}

module.exports = { createFor, createCompanyAdmin, resetToDefault, freeUsername, createMissing, backfillOnce, loginsByAccount };
