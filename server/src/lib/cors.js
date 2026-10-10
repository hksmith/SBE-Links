// CORS + CSRF guard for the browser frontend.
//  - Origins listed in CLIENT_ORIGIN may call the API with cookies (credentialed CORS).
//  - Browsers always send an Origin header on cross-site writes. When CLIENT_ORIGIN is set, a POST/PUT/DELETE
//    from any other origin is refused: with SameSite=None cookies this is what stops other websites from
//    acting as the logged-in admin. Requests without an Origin header (curl, server-to-server) are unaffected.
const config = require('../config');

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

// Returns true when the request has been fully answered here (preflight or refusal).
function guard(req, res) {
  const origin = req.headers.origin, allowed = config.clientOrigins;
  const ok = !!origin && allowed.includes(origin);
  if (ok) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    if (ok) {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    res.writeHead(204);
    res.end();
    return true;
  }
  if (!SAFE.has(req.method) && origin && allowed.length && !ok) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'origin', message: 'This origin is not allowed.' }));
    return true;
  }
  return false;
}

module.exports = { guard };
