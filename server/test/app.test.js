// End-to-end tests of the HTTP API against the in-memory MongoDB stand-in:  npm test
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'test-pass';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const database = require('../src/db');
const { fakeDb } = require('./fake-mongo');
const auth = require('../src/services/auth');
const { importLegacy } = require('../src/services/migrate');
const { createApp } = require('../src/app');

let server, base, cookie = '';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const req = async (method, url, body, extra = {}) => {
  const r = await fetch(base + url, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', cookie, ...extra }, body: body ? JSON.stringify(body) : undefined });
  return r;
};

before(async () => {
  database.use(fakeDb());
  await database.ensureIndexes();
  await auth.init();
  server = http.createServer(createApp()).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('root answers with a small JSON status (the UI is the separate frontend)', async () => {
  const r = await req('GET', '/');
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), { name: 'SBPO Link Tree API', status: 'ok' });
});

test('health check for the host', async () => {
  const r = await req('GET', '/health');
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), { ok: true });
});

test('the API needs a session; the old /admin pages are gone', async () => {
  assert.strictEqual((await req('GET', '/api/accounts')).status, 401);
  assert.strictEqual((await req('POST', '/login', { u: 'admin', p: 'nope' })).status, 401);
  let r = await req('POST', '/login', { u: 'admin', p: 'test-pass' });
  assert.strictEqual(r.status, 200);
  cookie = r.headers.get('set-cookie').split(';')[0];
  assert.strictEqual((await req('GET', '/api/accounts')).status, 200);
  assert.strictEqual((await req('GET', '/admin')).status, 404);
  assert.strictEqual((await req('GET', '/admin/js/main.js')).status, 404);
});

test('CORS: only CLIENT_ORIGIN may call the API with cookies; other sites cannot write', async () => {
  const config = require('../src/config');
  const app = 'https://app.example.com', evil = 'https://evil.example.net';
  config.clientOrigins.push(app);
  try {
    // preflight from the allowed origin
    let r = await req('OPTIONS', '/api/accounts', undefined, { Origin: app, 'Access-Control-Request-Method': 'PUT' });
    assert.strictEqual(r.status, 204);
    assert.strictEqual(r.headers.get('access-control-allow-origin'), app);
    assert.strictEqual(r.headers.get('access-control-allow-credentials'), 'true');
    assert.match(r.headers.get('access-control-allow-methods'), /PUT/);
    // preflight from anywhere else gets no permission
    r = await req('OPTIONS', '/api/accounts', undefined, { Origin: evil });
    assert.strictEqual(r.headers.get('access-control-allow-origin'), null);
    // allowed origin can read and write; the response carries the CORS headers
    r = await req('GET', '/api/accounts', undefined, { Origin: app });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers.get('access-control-allow-origin'), app);
    r = await req('POST', '/api/accounts', { name: 'Cors Person' }, { Origin: app });
    assert.strictEqual(r.status, 201);
    const created = await r.json();
    // a write from another origin is refused even with a valid session cookie (CSRF)
    r = await req('POST', '/api/accounts', { name: 'Evil' }, { Origin: evil });
    assert.strictEqual(r.status, 403);
    r = await req('DELETE', '/api/accounts/' + created.id, undefined, { Origin: evil });
    assert.strictEqual(r.status, 403);
    r = await req('POST', '/logout', undefined, { Origin: evil });
    assert.strictEqual(r.status, 403);
    // no Origin header (curl, server to server) is not affected; reads from other origins are not blocked but get no CORS grant
    assert.strictEqual((await req('DELETE', '/api/accounts/' + created.id)).status, 200);
    r = await req('GET', '/api/accounts', undefined, { Origin: evil });
    assert.strictEqual(r.headers.get('access-control-allow-origin'), null);
  } finally { config.clientOrigins.length = 0; }
});

test('session cookie follows COOKIE_SAMESITE / COOKIE_SECURE and logout clears it the same way', async () => {
  const config = require('../src/config');
  const login = async () => (await req('POST', '/login', { u: 'admin', p: 'test-pass' }, { 'x-forwarded-proto': 'https' })).headers.get('set-cookie');
  const first = await login();
  assert.match(first, /SameSite=Strict/);
  assert.match(first, /Max-Age=604800(;|$)/, 'default session is 7 days');
  config.cookieSameSite = 'none';
  try {
    const c = await login();
    assert.match(c, /SameSite=None/);
    assert.match(c, /; Secure/);
    // Secure is forced for SameSite=None even if the proxy header is missing
    const plain = (await req('POST', '/login', { u: 'admin', p: 'test-pass' })).headers.get('set-cookie');
    assert.match(plain, /; Secure/);
    const out = (await req('POST', '/logout')).headers.get('set-cookie');
    assert.match(out, /^sid=;/);
    assert.match(out, /Max-Age=0/);
    assert.match(out, /SameSite=None/);
  } finally { config.cookieSameSite = 'strict'; }
});

test('imports the legacy data.json', async () => {
  const file = path.join(__dirname, '..', 'data', 'legacy-data.json');
  const r = await importLegacy(file, { log: () => {} });
  assert.ok(r.accounts >= 1);
  const list = await (await req('GET', '/api/accounts')).json();
  assert.strictEqual(list.length, r.accounts);
  assert.ok(list.every(a => !a.photo || a.photo.startsWith('/media/')), 'photos moved to media collection');
  const views = list.reduce((s, a) => s + a.views + a.clicks, 0);
  assert.strictEqual(views, r.events);
  const brand = await (await req('GET', '/api/brand')).json();
  if (brand.logo) assert.match(brand.logo, /^\/media\/[a-f0-9]{32}$/);
});

test('create, edit, view, track, delete an account', async () => {
  let r = await req('POST', '/api/accounts', { name: '' });
  assert.strictEqual(r.status, 400);
  r = await req('POST', '/api/accounts', { name: 'Yiha Yimam' });
  assert.strictEqual(r.status, 201);
  const a = await r.json();
  assert.strictEqual(a.slug, 'yiha-yimam');
  const dup = await (await req('POST', '/api/accounts', { name: 'Yiha Yimam' })).json();
  assert.strictEqual(dup.slug, 'yiha-yimam-2');

  const up = await (await req('POST', '/api/media', { data: PNG })).json();
  assert.match(up.url, /^\/media\/[a-f0-9]{32}$/);
  const img = await req('GET', up.url);
  assert.strictEqual(img.headers.get('content-type'), 'image/png');

  a.profile.logo = up.url;
  a.profile.company = 'Shaggar';
  a.blocks[1].items.push({ id: 'l1', ico: 'globe', title: 'Site', url: 'example.com' });
  r = await (await req('PUT', '/api/accounts/' + a.id, { ...a, slug: 'yiha-yimam-2' })).json();
  assert.strictEqual(r.slug, 'yiha-yimam', 'taken slug is refused');

  const page = await (await req('GET', '/n/yiha-yimam', null, { 'user-agent': 'Mozilla/5.0 (iPhone)' })).text();
  assert.match(page, /class="lgbar"><div class="lgc">/, 'logo rendered in the top-right bar');
  r = await req('GET', `/go/${a.id}/l1?s=nfc`, null, { 'user-agent': 'Mozilla/5.0 (Android)' });
  assert.strictEqual(r.headers.get('location'), 'https://example.com');
  await new Promise(res => setTimeout(res, 50));

  const d = await (await req('GET', '/api/accounts/' + a.id)).json();
  assert.strictEqual(d.stats.views, 1);
  assert.strictEqual(d.stats.taps, 1);
  assert.strictEqual(d.stats.clicks, 1);
  assert.strictEqual(d.stats.byLink.l1, 1);
  assert.strictEqual(d.stats.dev.iOS, 1);
  assert.strictEqual(d.stats.days.at(-1).v, 1);
  assert.strictEqual(d.stats.recent[0].title, 'Site');

  assert.strictEqual((await req('DELETE', '/api/accounts/' + a.id)).status, 200);
  assert.strictEqual((await req('GET', '/yiha-yimam')).status, 404);
});

test('logo floats over the photo for banner layout', async () => {
  const a = await (await req('POST', '/api/accounts', { name: 'Banner Test' })).json();
  const html = await (await req('POST', '/api/preview', { ...a, profile: { ...a.profile, photo: PNG, logo: PNG }, theme: { ...a.theme, layout: 'banner' } })).text();
  assert.match(html, /<div class="lgo"><div class="lgc">/);
});
