// Admin login: one admin user from config, signed session cookie, simple brute-force limiter.
const crypto = require('crypto');
const config = require('../config');
const settings = require('../repositories/settings');

let secret = null;
const WEEK = 7 * 864e5;
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

// Returns { ok, cookie } or { error: 'rate' | 'bad' }
function login(req, user, pass) {
  const ip = clientIp(req), now = Date.now();
  tries[ip] = (tries[ip] || []).filter(t => now - t < 6e5);
  if (tries[ip].length >= 8) return { error: 'rate' };
  if (same(user, config.adminUser) && same(pass, config.adminPassword)) {
    const exp = String(now + WEEK);
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return { ok: true, cookie: `sid=${exp}.${sign(exp)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${WEEK / 1000}${secure}` };
  }
  tries[ip].push(now);
  return { error: 'bad' };
}

const logoutCookie = 'sid=; Path=/; Max-Age=0';

module.exports = { init, isLoggedIn, login, logoutCookie };
