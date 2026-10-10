// Admin login: one admin user from config, signed session cookie, simple brute-force limiter.
const crypto = require('crypto');
const config = require('../config');
const settings = require('../repositories/settings');

let secret = null;
const tries = {};

async function init() {
  secret = await settings.get('secret');
  if (!secret) secret = await settings.set('secret', crypto.randomBytes(24).toString('hex'));
}

const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const sign = s => crypto.createHmac('sha256', secret).update(s).digest('hex');

function isLoggedIn(req) {
  const m = /(?:^|; )sid=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  return +exp > Date.now() && !!sig && sig.length === 64 && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(exp)));
}

function clientIp(req) {
  return (config.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;
}

// Session cookie. SameSite=None (frontend on another site) requires Secure, so it is forced on.
function cookie(req, value, maxAge) {
  const ss = config.cookieSameSite, https = req.headers['x-forwarded-proto'] === 'https';
  const secure = ss === 'none' || config.cookieSecure === true || (config.cookieSecure === undefined && https);
  return `sid=${value}; HttpOnly; SameSite=${ss[0].toUpperCase() + ss.slice(1)}; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
const logout = req => cookie(req, '', 0);

// Returns { ok, cookie } or { error: 'rate' | 'bad' }
function login(req, user, pass) {
  const ip = clientIp(req), now = Date.now();
  tries[ip] = (tries[ip] || []).filter(t => now - t < 6e5);
  if (tries[ip].length >= 8) return { error: 'rate' };
  if (same(user, config.adminUser) && same(pass, config.adminPassword)) {
    const exp = String(now + config.sessionDays * 864e5);
    return { ok: true, cookie: cookie(req, `${exp}.${sign(exp)}`, config.sessionDays * 864e2) };
  }
  tries[ip].push(now);
  return { error: 'bad' };
}

module.exports = { init, isLoggedIn, login, logout };
