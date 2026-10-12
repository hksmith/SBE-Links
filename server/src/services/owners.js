// View-only logins for card owners.
// Every card can get one login whose username is the card's page address and whose password is the shared
// first-time password (DEFAULT_USER_PASSWORD). It can only see that card's statistics, and the person must
// choose their own password the first time they sign in.
const config = require('../config');
const auth = require('./auth');
const usersRepo = require('../repositories/users');

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
async function createFor(account) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = await freeUsername(account.slug);
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

module.exports = { createFor, resetToDefault, freeUsername };
