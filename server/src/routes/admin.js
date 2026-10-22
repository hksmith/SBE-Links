// Admin entry points: login/logout and serving the built admin web app (client/dist).
const fs = require('fs');
const path = require('path');
const config = require('../config');
const auth = require('../services/auth');
const brand = require('../services/brand');
const system = require('../services/system');
const { json, html, redirect, readJson, sendStatic } = require('../lib/http');

const NOT_BUILT = `<!doctype html><meta charset="utf-8"><title>SBPO Link Tree</title>
<body style="font:15px/1.5 system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 20px;color:#162038">
<h2>The admin app has not been built yet</h2>
<p>From the project folder run:</p><pre style="background:#f2f5fb;padding:12px;border-radius:10px">npm install
npm run build</pre><p>then reload this page.</p></body>`;

module.exports = router => {
  // The site root has no page of its own: always send people to the admin.
  router.get('/', (req, res) => redirect(res, '/admin'));

  router.post('/login', async (req, res) => {
    const b = (await readJson(req, 1e4)) || {};
    const r = await auth.login(req, String(b.u ?? ''), String(b.p ?? ''));
    if (r.error) return json(res, { error: r.error }, r.error === 'rate' ? 429 : 401);
    return json(res, { ok: true, user: r.user }, 200, { 'Set-Cookie': r.cookie });
  });

  router.all('/logout', (req, res) => redirect(res, '/admin', 302, { 'Set-Cookie': auth.logoutCookie }));

  router.get('/admin', async (req, res) => {
    if (!fs.existsSync(path.join(config.clientDir, 'index.html'))) return html(res, NOT_BUILT, 503);
    return sendStatic(res, config.clientDir, (await auth.currentUser(req)) ? 'index.html' : 'login.html', { cache: 'no-store' });
  });

  // CSS / JS / images of the admin app (public files, no secrets in them).
  // Built files under assets/ have a content hash in their name, so they can be cached for a long time.
  router.get('/admin/*', (req, res, { params }) => {
    if (/\.html$/i.test(params.rest)) return redirect(res, '/admin');
    const hashed = /^assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(params.rest);
    return sendStatic(res, config.clientDir, params.rest, hashed ? { cache: 'public, max-age=31536000, immutable' } : undefined);
  });

  // Footer text + logo, and the system name / logo / colours, for the sign-in page (public: nothing secret in them).
  router.get('/brand.json', async (req, res) => json(res, { ...(await brand.get()), system: await system.get() }));

  router.get('/favicon.ico', (req, res) => sendStatic(res, path.join(config.clientDir, 'assets'), 'favicon.svg'));
};
