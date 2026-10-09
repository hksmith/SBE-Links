// Admin entry points: login/logout and serving the admin web app from /client.
const path = require('path');
const config = require('../config');
const auth = require('../services/auth');
const { json, redirect, readJson, sendStatic } = require('../lib/http');

module.exports = router => {
  // The site root has no page of its own: always send people to the admin.
  router.get('/', (req, res) => redirect(res, '/admin'));

  router.post('/login', async (req, res) => {
    const b = (await readJson(req, 1e4)) || {};
    const r = auth.login(req, String(b.u ?? ''), String(b.p ?? ''));
    if (r.error) return json(res, { error: r.error }, r.error === 'rate' ? 429 : 401);
    return json(res, { ok: true }, 200, { 'Set-Cookie': r.cookie });
  });

  router.all('/logout', (req, res) => redirect(res, '/admin', 302, { 'Set-Cookie': auth.logoutCookie }));

  router.get('/admin', (req, res) =>
    sendStatic(res, config.clientDir, auth.isLoggedIn(req) ? 'index.html' : 'login.html', { cache: 'no-store' }));

  // CSS / JS / images of the admin app (public files, no secrets in them).
  router.get('/admin/*', (req, res, { params }) => {
    if (/\.html$/i.test(params.rest)) return redirect(res, '/admin');
    return sendStatic(res, config.clientDir, params.rest);
  });

  router.get('/favicon.ico', (req, res) => sendStatic(res, path.join(config.clientDir, 'assets'), 'favicon.svg'));
};
