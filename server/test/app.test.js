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

test('root redirects to /admin', async () => {
  const r = await req('GET', '/');
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.get('location'), '/admin');
});

test('admin shows login page until signed in, then the app', async () => {
  let r = await req('GET', '/admin');
  assert.match(await r.text(), /id="login-form"/);
  assert.strictEqual((await req('GET', '/api/accounts')).status, 401);
  assert.strictEqual((await req('POST', '/login', { u: 'admin', p: 'nope' })).status, 401);
  r = await req('POST', '/login', { u: 'admin', p: 'test-pass' });
  assert.strictEqual(r.status, 200);
  cookie = r.headers.get('set-cookie').split(';')[0];
  r = await req('GET', '/admin');
  assert.match(await r.text(), /id="app"/);
  assert.strictEqual((await req('GET', '/admin/js/main.js')).status, 200);
  assert.strictEqual((await req('GET', '/admin/../server/src/config.js')).status, 404);
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
