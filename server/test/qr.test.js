// QR codes: admin-only API, file uploads, scan tracking at /q/<code>.  npm test
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'test-pass';
process.env.GEO_LOOKUP = 'off'; // no calls to the IP-location services from tests

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const database = require('../src/db');
const { fakeDb } = require('./fake-mongo');
const auth = require('../src/services/auth');
const { createApp } = require('../src/app');

let server, base, cookie = '';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0 Mobile Safari/537.36';

const req = (method, url, body, extra = {}) => fetch(base + url, {
  method, redirect: 'manual', headers: { 'Content-Type': 'application/json', cookie, ...extra },
  body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body),
});
const scan = (code, ua, ip, extra = {}) => fetch(`${base}/q/${code}`, { redirect: 'manual', headers: { 'user-agent': ua, 'x-forwarded-for': ip, ...extra } });
const settle = () => new Promise(r => setTimeout(r, 30)); // scans are recorded in the background

before(async () => {
  database.use(fakeDb());
  await database.ensureIndexes();
  await auth.init();
  server = http.createServer(createApp()).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const r = await req('POST', '/login', { u: 'admin', p: 'test-pass' });
  cookie = r.headers.get('set-cookie').split(';')[0];
});
after(() => server.close());

test('QR API needs an admin', async () => {
  const saved = cookie;
  cookie = '';
  assert.strictEqual((await req('GET', '/api/qr')).status, 401);
  cookie = saved;
  await req('POST', '/api/users', { username: 'watcher', password: 'secret1', role: 'viewer' });
  const r = await fetch(base + '/login', { method: 'POST', body: JSON.stringify({ u: 'watcher', p: 'secret1' }) });
  const viewer = r.headers.get('set-cookie').split(';')[0];
  assert.strictEqual((await fetch(base + '/api/qr', { headers: { cookie: viewer } })).status, 403);
});

test('link QR: create, scan, redirect and count', async () => {
  let r = await req('POST', '/api/qr', { name: 'Flyer', type: 'link', url: 'example.com/offer' });
  assert.strictEqual(r.status, 201);
  const q = await r.json();
  assert.match(q.code, /^[a-z0-9]{6}$/);
  assert.strictEqual(q.url, 'https://example.com/offer');

  r = await scan(q.code, IPHONE, '1.1.1.1', { 'x-vercel-ip-country': 'ET', 'accept-language': 'am-ET,en;q=0.8' });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.get('location'), 'https://example.com/offer');
  await scan(q.code, IPHONE, '1.1.1.1'); // same phone a moment later: one scan
  await scan(q.code, ANDROID, '2.2.2.2');
  await scan(q.code, 'facebookexternalhit/1.1', '3.3.3.3'); // link preview bot: not counted
  await scan(q.code.toUpperCase(), ANDROID, '4.4.4.4'); // codes are case-insensitive
  await settle();

  r = await req('GET', `/api/qr/${q.id}?tz=180`);
  const d = await r.json();
  assert.strictEqual(d.stats.scans, 3);
  assert.strictEqual(d.stats.unique, 3);
  assert.strictEqual(d.stats.today, 3);
  assert.strictEqual(d.stats.os.iOS, 1);
  assert.strictEqual(d.stats.os.Android, 2);
  assert.strictEqual(d.stats.br['Samsung Internet'], 2);
  assert.strictEqual(d.stats.cc.ET, 1);
  assert.strictEqual(d.stats.lang['am-ET'], 1);
  assert.strictEqual(d.stats.days.length, 30);
  assert.strictEqual(d.stats.days.at(-1).n, 3);
  assert.strictEqual(d.stats.recent.length, 3);

  r = await req('GET', '/api/qr');
  const [row] = await r.json();
  assert.strictEqual(row.scans, 3);

  // Excel export
  r = await req('GET', `/api/qr/${q.id}/scans.xlsx`);
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get('content-type'), /spreadsheetml/);

  // Change where it goes without changing the code
  r = await req('PUT', `/api/qr/${q.id}`, { url: 'https://example.com/new' });
  assert.strictEqual((await r.json()).code, q.code);
  assert.strictEqual((await scan(q.code, IPHONE, '9.9.9.9')).headers.get('location'), 'https://example.com/new');

  // Pause: shows a page instead and isn't counted
  await req('PUT', `/api/qr/${q.id}`, { active: false });
  r = await scan(q.code, ANDROID, '8.8.8.8');
  assert.strictEqual(r.status, 200);
  assert.match(await r.text(), /not active/);
  await settle();
  assert.strictEqual((await (await req('GET', `/api/qr/${q.id}`)).json()).stats.scans, 4);

  // Reset statistics
  await req('POST', `/api/qr/${q.id}/reset`);
  assert.strictEqual((await (await req('GET', `/api/qr/${q.id}`)).json()).stats.scans, 0);
});

test('file QR: upload, serve inline, replace, delete', async () => {
  const pdf = Buffer.from('%PDF-1.4 test file');
  let r = await req('POST', '/api/qr/files', pdf, { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent('Menu ዝርዝር.pdf') });
  assert.strictEqual(r.status, 201);
  const f = await r.json();
  assert.strictEqual(f.name, 'Menu ዝርዝር.pdf');

  assert.strictEqual((await req('POST', '/api/qr', { name: 'Menu', type: 'file' })).status, 400); // no file
  r = await req('POST', '/api/qr', { name: 'Menu', type: 'file', file: { id: f.id } });
  const q = await r.json();
  assert.strictEqual(q.file.size, pdf.length);

  r = await scan(q.code, IPHONE, '5.5.5.5');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get('content-type'), 'application/pdf');
  assert.match(r.headers.get('content-disposition'), /^inline/);
  assert.deepStrictEqual(Buffer.from(await r.arrayBuffer()), pdf);

  // Byte ranges (video players)
  r = await scan(q.code, IPHONE, '5.5.5.5', { range: 'bytes=0-3' });
  assert.strictEqual(r.status, 206);
  assert.strictEqual(await r.text(), '%PDF');

  // Any other file type downloads
  r = await req('POST', '/api/qr/files', Buffer.from('PK zip'), { 'Content-Type': 'application/zip', 'X-File-Name': 'pack.zip' });
  const f2 = await r.json();
  await req('PUT', `/api/qr/${q.id}`, { file: { id: f2.id } });
  r = await scan(q.code, ANDROID, '6.6.6.6');
  assert.match(r.headers.get('content-disposition'), /^attachment/);
  assert.strictEqual((await req('GET', `/q/${q.code}`)).status, 200);
  assert.strictEqual(await database.db.qrfiles.findOne({ _id: f.id }), null); // the replaced file is gone

  assert.strictEqual((await req('DELETE', `/api/qr/${q.id}`)).status, 200);
  assert.strictEqual(await database.db.qrfiles.findOne({ _id: f2.id }), null);
  assert.strictEqual((await scan(q.code, IPHONE, '7.7.7.7')).status, 404);
});

test('text QR and custom short codes', async () => {
  let r = await req('POST', '/api/qr', { name: 'Wi-Fi note', type: 'text', text: 'Password: <b>guest</b> see https://example.com', code: 'Office-WiFi' });
  const q = await r.json();
  assert.strictEqual(q.code, 'office-wifi');
  r = await scan('office-wifi', IPHONE, '1.2.3.4');
  const body = await r.text();
  assert.match(body, /&lt;b&gt;guest/);
  assert.match(body, /<a href="https:\/\/example.com"/);
  assert.strictEqual((await req('POST', '/api/qr', { name: 'Again', type: 'text', text: 'x', code: 'office-wifi' })).status, 409);
  assert.strictEqual((await req('POST', '/api/qr', { name: 'Bad', type: 'text', text: 'x', code: 'a b' })).status, 400);
});

test('files over the limit are refused', async () => {
  const r = await req('POST', '/api/qr/files', Buffer.alloc(10 * 1024 * 1024 + 1), { 'Content-Type': 'application/octet-stream' });
  assert.strictEqual(r.status, 413);
});

test('country: the phone\'s own address decides, not the country of the proxy in between', async () => {
  const geo = require('../src/services/geo');
  const fake = (headers, remote = '10.0.0.5') => ({ headers, socket: { remoteAddress: remote } });
  // Vercel passes its own country header: used as is
  assert.strictEqual((await geo.locate(fake({ 'x-vercel-ip-country': 'ET', 'x-vercel-ip-city': 'Addis%20Ababa' }))).city, 'Addis Ababa');
  // Came through Vercel, Cloudflare labels it with Vercel's location (ZA): not trusted
  const viaVercel = { 'x-forwarded-for': '196.188.1.1, 76.76.21.1', 'cf-connecting-ip': '76.76.21.1', 'cf-ipcountry': 'ZA' };
  assert.strictEqual((await geo.locate(fake(viaVercel))).cc, 'Unknown');
  // Phone straight to Cloudflare: its country header is right
  assert.strictEqual((await geo.locate(fake({ 'x-forwarded-for': '196.188.1.1', 'cf-connecting-ip': '196.188.1.1', 'cf-ipcountry': 'ET' }))).cc, 'ET');

  // With lookups on, the phone's address is looked up (first service, then the second one when it fails)
  const real = globalThis.fetch, asked = [];
  process.env.GEO_LOOKUP = 'on';
  try {
    globalThis.fetch = async url => { if (/icloud/.test(url)) throw new Error('no relay list in this test'); asked.push(String(url)); return { ok: true, json: async () => ({ success: true, country_code: 'ET', city: 'Addis Ababa' }) }; };
    let r = await geo.locate(fake(viaVercel));
    assert.deepStrictEqual([r.cc, r.city, r.via], ['ET', 'Addis Ababa', 'ip']);
    assert.match(asked[0], /ipwho\.is\/196\.188\.1\.1/);
    await geo.locate(fake(viaVercel));
    assert.strictEqual(asked.length, 1); // remembered
    globalThis.fetch = async url => { if (/icloud/.test(url)) throw new Error('no relay list in this test'); asked.push(String(url)); if (/ipwho/.test(url)) throw new Error('down'); return { ok: true, json: async () => ({ country: 'KE' }) }; };
    r = await geo.locate(fake({ 'x-forwarded-for': '41.90.1.1' }));
    assert.strictEqual(r.cc, 'KE');
    assert.strictEqual((await geo.locate(fake({}, '127.0.0.1'))).cc, 'Unknown'); // private addresses are never looked up
    assert.ok(!asked.some(u => u.includes('127.0.0.1')));
  } finally { globalThis.fetch = real; process.env.GEO_LOOKUP = 'off'; geo.clearCache(); }

  const r = await req('GET', '/api/qr-location-check', undefined, { 'x-forwarded-for': '196.188.1.1, 76.76.21.1', 'cf-ipcountry': 'ZA', 'x-vercel-id': 'jnb1::abc' });
  const j = await r.json();
  assert.strictEqual(j.visitorIp, '196.188.1.1');
  assert.strictEqual(j.cameThroughVercel, true);
  assert.strictEqual(j.result.cc, 'Unknown');
});

test('iCloud Private Relay: Apple\'s list decides the country of relay addresses', async () => {
  const relay = require('../src/services/relay');
  const geo = require('../src/services/geo');
  relay.useList(['172.224.226.0/27,ET,ET-AA,Addis Ababa,', '172.225.0.0/24,US,US-NY,New York,', '2a02:26f7:b3c0:4000::/64,ET,ET-AA,Addis Ababa,', 'bad line', ''].join('\n'));
  const fake = xff => ({ headers: { 'x-forwarded-for': xff, 'x-vercel-id': 'cpt1::x' }, socket: { remoteAddress: '10.0.0.1' } });
  let r = await geo.locate(fake('172.224.226.17, 76.76.21.1'));
  assert.deepStrictEqual([r.cc, r.city, r.relay], ['ET', 'Addis Ababa', true]);
  r = await geo.locate(fake('2a02:26f7:b3c0:4000:1234::5'));
  assert.strictEqual(r.cc, 'ET');
  assert.strictEqual((await geo.locate(fake('172.225.0.200'))).cc, 'US');
  assert.strictEqual((await geo.locate(fake('172.224.226.40'))).relay, undefined); // just outside the /27: not a relay address

  // A scan through the relay is stored as such
  const q = await (await req('POST', '/api/qr', { name: 'Relay test', type: 'link', url: 'https://example.com' })).json();
  await scan(q.code, IPHONE, '172.224.226.9');
  await settle();
  const d = await (await req('GET', `/api/qr/${q.id}`)).json();
  assert.strictEqual(d.stats.cc.ET, 1);
  assert.strictEqual(d.stats.recent[0].relay, true);
  relay.useList('');
});
