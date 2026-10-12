// Sign-in and permissions.
//   - The admin from .env (ADMIN_USER / ADMIN_PASSWORD) always exists and always has full access.
//   - More people are added from the admin app (users collection) as either
//       admin  – full access, same as the .env admin
//       viewer – can only look at statistics (all cards, or only the cards they were given)
// Sessions are a signed cookie: sid=<user>.<ver>.<expiry>.<signature>
const crypto = require('crypto');
const config = require('../config');
const settings = require('../repositories/settings');
const usersRepo = require('../repositories/users');

let secret = null;
const WEEK = 7 * 864e5;
const tries = {};
const BUILTIN = '@admin'; // id of the .env admin inside the session cookie (not a valid username)
const ROLES = ['admin', 'viewer'];

async function init() {
  secret = await settings.get('secret');
  if (!secret) secret = await settings.set('secret', crypto.randomBytes(24).toString('hex'));
}

const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const sign = s => crypto.createHmac('sha256', secret).update(s).digest('hex');
const b64 = s => Buffer.from(s).toString('base64url');
const unb64 = s => Buffer.from(s, 'base64url').toString();

function hashPassword(pass, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(pass), salt, 32).toString('hex') };
}
const checkPassword = (pass, u) => !!u.salt && same(hashPassword(pass, u.salt).hash, u.hash);

const builtinUser = () => ({ username: config.adminUser, name: 'Main admin', role: 'admin', accounts: 'all', builtin: true, ver: 0 });

// What the browser is allowed to see about a user.
// mustChange: still on the generic first-time password, has to pick their own before seeing anything.
// owner: the card this login was created for (card-owner logins are removed together with their card).
// company: company admin of that company (sees all its cards).
const publicUser = u => ({
  username: u.username, name: u.name || u.username, role: u.role, accounts: u.accounts, builtin: !!u.builtin,
  mustChange: !!u.mustChange, owner: u.owner || null, company: u.company || null, created: u.created || 0,
});

function makeCookie(req, u) {
  const exp = String(Date.now() + WEEK);
  const body = `${b64(u.builtin ? BUILTIN : u.username)}.${u.ver || 0}.${exp}`;
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `sid=${body}.${sign(body)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${WEEK / 1000}${secure}`;
}

// Returns the signed-in user, or null. Reads the user from the database every time,
// so a role change or a deleted user takes effect immediately.
async function currentUser(req) {
  if (req._user !== undefined) return req._user;
  req._user = null;
  const m = /(?:^|; )sid=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const parts = m[1].split('.');
  if (parts.length !== 4) return null;
  const [id, ver, exp, sig] = parts, body = `${id}.${ver}.${exp}`;
  if (!(+exp > Date.now()) || sig.length !== 64 || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(body)))) return null;
  const name = unb64(id);
  if (name === BUILTIN) return (req._user = builtinUser());
  const u = await usersRepo.get(name);
  if (!u || String(u.ver || 0) !== ver) return null;
  return (req._user = u);
}

function clientIp(req) {
  return (config.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;
}

// Returns { ok, cookie, user } or { error: 'rate' | 'bad' }
async function login(req, user, pass) {
  const ip = clientIp(req), now = Date.now();
  tries[ip] = (tries[ip] || []).filter(t => now - t < 6e5);
  if (tries[ip].length >= 8) return { error: 'rate' };
  let u = null;
  if (same(user, config.adminUser)) {
    if (same(pass, config.adminPassword)) u = builtinUser();
  } else {
    const found = await usersRepo.get(String(user).trim().toLowerCase());
    if (found && checkPassword(pass, found)) u = found;
  }
  if (u) return { ok: true, cookie: makeCookie(req, u), user: publicUser(u) };
  tries[ip].push(now);
  return { error: 'bad' };
}

const logoutCookie = 'sid=; Path=/; Max-Age=0';

// Permission helpers
const isAdmin = u => !!u && u.role === 'admin';
// `a` is a card ({ id, company }) or a company ({ id, isCompany: true }).
const canSee = (u, a) => !!u && !!a && (u.role === 'admin' || (u.company
  ? (a.isCompany ? a.id === u.company : a.company === u.company)
  : !a.isCompany && (u.accounts === 'all' || (Array.isArray(u.accounts) && u.accounts.includes(a.id)))));

module.exports = { init, currentUser, login, logoutCookie, makeCookie, hashPassword, checkPassword, publicUser, isAdmin, canSee, ROLES };
