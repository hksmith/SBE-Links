// Dashboard overview and system settings (name, logo, theme).  npm test
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'test-pass';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const database = require('../src/db');
const { fakeDb } = require('./fake-mongo');
const auth = require('../src/services/auth');
const { createApp } = require('../src/app');

let server, base, cookie = '';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const req = (method, url, body, c = cookie) => fetch(base + url, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', cookie: c }, body: body ? JSON.stringify(body) : undefined });
const settle = () => new Promise(r => setTimeout(r, 40));

before(async () => {
  database.use(fakeDb());
  await database.ensureIndexes();
  await auth.init();
  server = http.createServer(createApp()).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  cookie = (await req('POST', '/login', { u: 'admin', p: 'test-pass' })).headers.get('set-cookie').split(';')[0];
});
after(() => server.close());

test('system name, logo and theme: defaults, change, validation, public for the sign-in page', async () => {
  let s = await (await req('GET', '/api/system')).json();
  assert.strictEqual(s.name, 'SBPO Link Tree');
  assert.strictEqual(s.sidebar, 'dark');
  s = await (await req('PUT', '/api/system', { name: '  SBE   Admin ', logo: PNG, accent: '#0E7490', accent2: 'red', sidebar: 'light' })).json();
  assert.strictEqual(s.name, 'SBE Admin');
  assert.match(s.logo, /^\/media\/[a-f0-9]{32}$/);
  assert.strictEqual(s.accent, '#0e7490');
  assert.strictEqual(s.accent2, '#06b6d4'); // invalid colour keeps the default
  assert.strictEqual(s.sidebar, 'light');
  assert.strictEqual((await fetch(base + s.logo)).status, 200);
  const pub = await (await fetch(base + '/brand.json')).json();
  assert.strictEqual(pub.system.name, 'SBE Admin');
  s = await (await req('PUT', '/api/system', { name: '' })).json();
  assert.strictEqual(s.name, 'SBPO Link Tree'); // empty name goes back to the default
  assert.match(s.logo, /^\/media\//); // untouched fields stay

  await req('POST', '/api/users', { username: 'watch', password: 'secret1', role: 'viewer' });
  const v = (await req('POST', '/login', { u: 'watch', p: 'secret1' }, '')).headers.get('set-cookie').split(';')[0];
  assert.strictEqual((await req('GET', '/api/system', undefined, v)).status, 200);
  assert.strictEqual((await req('PUT', '/api/system', { name: 'x' }, v)).status, 403);
});

test('overview: counts, 30-day activity, today, top cards, QR scans and recent activity', async () => {
  const a = await (await req('POST', '/api/accounts', { name: 'Abebe Kebede', login: false })).json();
  const b = await (await req('POST', '/api/accounts', { name: 'Sara Ali', login: false })).json();
  await fetch(`${base}/n/${a.slug}`, { headers: { 'user-agent': 'iPhone' } });
  await fetch(`${base}/${a.slug}`);
  await fetch(`${base}/${b.slug}`);
  const qr = await (await req('POST', '/api/qr', { name: 'Flyer', type: 'link', url: 'https://example.com' })).json();
  await fetch(`${base}/q/${qr.code}`, { redirect: 'manual', headers: { 'user-agent': 'Android Mobile', 'x-forwarded-for': '1.1.1.1' } });
  await settle();

  const o = await (await req('GET', '/api/overview?tz=180')).json();
  assert.deepStrictEqual(o.counts, { cards: 2, companies: 0, qr: 1, qrActive: 1 });
  assert.strictEqual(o.totals.views, 3);
  assert.strictEqual(o.totals.taps, 1);
  assert.strictEqual(o.totals.scans, 1);
  assert.strictEqual(o.days.length, 30);
  assert.deepStrictEqual({ ...o.today }, { views: 3, taps: 1, clicks: 0, scans: 1 });
  assert.strictEqual(o.topCards[0].name, 'Abebe Kebede');
  assert.strictEqual(o.topQr[0].scans, 1);
  assert.strictEqual(o.recent.length, 4);
  assert.strictEqual(o.recent[0].kind, 'scan');
  assert.ok(o.recent.some(r => r.kind === 'tap' && r.name === 'Abebe Kebede'));

  // A viewer who can see only one card gets only that card's numbers, and no QR codes.
  await req('POST', '/api/users', { username: 'one', password: 'secret1', role: 'viewer', accounts: [b.id] });
  const v = (await req('POST', '/login', { u: 'one', p: 'secret1' }, '')).headers.get('set-cookie').split(';')[0];
  const ov = await (await req('GET', '/api/overview', undefined, v)).json();
  assert.deepStrictEqual(ov.counts, { cards: 1, companies: 0, qr: 0, qrActive: 0 });
  assert.strictEqual(ov.totals.views, 1);
  assert.strictEqual(ov.recent.length, 1);
  assert.strictEqual(ov.topQr.length, 0);
});
