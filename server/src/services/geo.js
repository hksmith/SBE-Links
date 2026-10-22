// Where a QR scan came from (country, city).
//
// Requests reach this server through other servers (phone → Vercel → Render / Cloudflare → here). The country header
// Cloudflare adds (cf-ipcountry) describes whoever connected to Cloudflare — that is Vercel's server (e.g. Johannesburg
// or Paris), not the phone — so it can't be trusted when the request came through Vercel. Instead:
//   0. iCloud Private Relay (Safari with iCloud+): the phone's address is one of Apple's relay addresses; Apple's own
//      list says which country / city it serves (services/relay.js). Such scans are marked relay: true;
//   1. x-vercel-ip-country, when Vercel passes it on (Vercel works it out from the phone's own address);
//   2. otherwise the phone's own IP address (first one in x-forwarded-for) is looked up with a free IP-location
//      service (ipwho.is, then api.country.is). Results are kept in memory for a day; the IP address is not stored;
//   3. cf-ipcountry only when the request did NOT come through Vercel (the phone connected to Cloudflare itself).
// Set GEO_LOOKUP=off in server/.env to never contact the IP-location services.

const DAY = 864e5;
const relay = require('./relay');
const cache = new Map(); // ip -> { cc, city, t }
const PRIVATE = /^(10\.|127\.|0\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|::$|f[cd][0-9a-f]{2}:|fe80:)/i;
const CC = /^[A-Z]{2}$/;

const hdr = (req, name) => { const v = req.headers[name]; if (!v) return ''; try { return decodeURIComponent(String(v)).trim(); } catch { return String(v).trim(); } };
const first = v => String(v || '').split(',')[0].trim();

// The phone's own address: the first one in the forwarding chain (each proxy adds the address it received from).
function clientIp(req) {
  const ip = first(req.headers['x-vercel-forwarded-for']) || first(req.headers['x-forwarded-for']) || first(req.headers['x-real-ip']) || req.socket.remoteAddress || '';
  return ip.replace(/^::ffff:/, '');
}

// True when something sat in front of Cloudflare (Vercel): its headers are there, or the phone's address differs
// from the address that connected to Cloudflare.
const viaVercel = req => Object.keys(req.headers).some(k => k.startsWith('x-vercel-'))
  || (!!req.headers['cf-connecting-ip'] && first(req.headers['cf-connecting-ip']) !== clientIp(req));

async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(2500), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// Country (and city when known) of a public IP address, or null.
async function lookup(ip) {
  if (!ip || PRIVATE.test(ip) || String(process.env.GEO_LOOKUP).toLowerCase() === 'off') return null;
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.t < DAY) return hit.cc ? { cc: hit.cc, city: hit.city } : null;
  let out = null;
  try {
    const j = await getJson(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code,city`);
    if (j && j.success !== false && CC.test(j.country_code || '')) out = { cc: j.country_code, city: String(j.city || '').slice(0, 60) };
  } catch { /* try the next service */ }
  if (!out) {
    try {
      const j = await getJson(`https://api.country.is/${encodeURIComponent(ip)}`);
      if (j && CC.test(j.country || '')) out = { cc: j.country, city: '' };
    } catch { /* unknown */ }
  }
  if (cache.size > 5000) cache.delete(cache.keys().next().value);
  cache.set(ip, { ...(out || { cc: '', city: '' }), t: Date.now() });
  return out;
}

// { cc: 'ET' | 'Unknown', city, via, relay? } for a request.
async function locate(req) {
  const ip = clientIp(req);
  const r = await relay.lookup(ip);
  if (r) return { ...r, via: 'icloud-relay', relay: true };
  const vc = hdr(req, 'x-vercel-ip-country').toUpperCase();
  if (CC.test(vc) && vc !== 'XX') return { cc: vc, city: hdr(req, 'x-vercel-ip-city').slice(0, 60), via: 'vercel' };
  const found = await lookup(ip);
  if (found) return { ...found, via: 'ip' };
  const cf = hdr(req, 'cf-ipcountry').toUpperCase();
  if (!viaVercel(req) && CC.test(cf) && cf !== 'XX' && cf !== 'T1') return { cc: cf, city: '', via: 'cloudflare' };
  return { cc: 'Unknown', city: '', via: 'none' };
}

module.exports = { locate, lookup, clientIp, viaVercel, clearCache: () => cache.clear() };
