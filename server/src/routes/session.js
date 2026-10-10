// Session endpoints: sign in / out, plus a tiny root response. The admin UI lives in the separate frontend/ app.
const config = require('../config');
const auth = require('../services/auth');
const { json, redirect, readJson } = require('../lib/http');

module.exports = router => {
  // Nothing to show here: send people to the frontend when it is configured, otherwise say the API is up.
  router.get('/', (req, res) => (config.clientOrigins[0] ? redirect(res, config.clientOrigins[0]) : json(res, { name: 'SBPO Link Tree API', status: 'ok' })));

  router.get('/health', (req, res) => json(res, { ok: true })); // for Render's health check

  router.post('/login', async (req, res) => {
    const b = (await readJson(req, 1e4)) || {};
    const r = auth.login(req, String(b.u ?? ''), String(b.p ?? ''));
    if (r.error) return json(res, { error: r.error }, r.error === 'rate' ? 429 : 401);
    return json(res, { ok: true }, 200, { 'Set-Cookie': r.cookie });
  });

  router.post('/logout', (req, res) => json(res, { ok: true }, 200, { 'Set-Cookie': auth.logout(req) }));
};
