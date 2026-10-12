// End-to-end tests of the HTTP API against the in-memory MongoDB stand-in:  npm test
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'test-pass';

// A stand-in for the built admin app (client/dist), so the tests don't need a Vite build.
const fs = require('fs');
const os = require('os');
const CLIENT = fs.mkdtempSync(require('path').join(os.tmpdir(), 'sbpo-client-'));
fs.mkdirSync(CLIENT + '/assets');
fs.writeFileSync(CLIENT + '/index.html', '<div id="app"></div>');
fs.writeFileSync(CLIENT + '/login.html', '<div id="login"></div>');
fs.writeFileSync(CLIENT + '/assets/index-AbCd1234.js', 'console.log(1)');
process.env.CLIENT_DIR = CLIENT;

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
after(() => { server.close(); fs.rmSync(CLIENT, { recursive: true, force: true }); });

test('root redirects to /admin', async () => {
  const r = await req('GET', '/');
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.get('location'), '/admin');
});

test('admin shows login page until signed in, then the app', async () => {
  let r = await req('GET', '/admin');
  assert.match(await r.text(), /id="login"/);
  assert.strictEqual((await req('GET', '/api/accounts')).status, 401);
  assert.strictEqual((await req('POST', '/login', { u: 'admin', p: 'nope' })).status, 401);
  r = await req('POST', '/login', { u: 'admin', p: 'test-pass' });
  assert.strictEqual(r.status, 200);
  cookie = r.headers.get('set-cookie').split(';')[0];
  r = await req('GET', '/admin');
  assert.match(await r.text(), /id="app"/);
  r = await req('GET', '/admin/assets/index-AbCd1234.js');
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get('cache-control'), /immutable/);
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

test('users: viewers only see statistics, admins manage users', async () => {
  const a1 = await (await req('POST', '/api/accounts', { name: 'Card One' })).json();
  const a2 = await (await req('POST', '/api/accounts', { name: 'Card Two' })).json();

  assert.strictEqual((await req('POST', '/api/users', { username: 'x', password: '123456' })).status, 400, 'short username');
  assert.strictEqual((await req('POST', '/api/users', { username: 'sales', password: '123' })).status, 400, 'short password');
  assert.strictEqual((await req('POST', '/api/users', { username: 'admin', password: '123456' })).status, 409, 'built-in admin name');
  let r = await req('POST', '/api/users', { username: 'Sales', name: 'Sales team', password: 'secret1', role: 'viewer', accounts: [a1.id, 'nope'] });
  assert.strictEqual(r.status, 201);
  const u = await r.json();
  assert.deepStrictEqual(u.accounts, [a1.id], 'unknown account ids dropped');
  assert.ok(!('hash' in u) && !('salt' in u), 'no password hash sent to the browser');
  assert.strictEqual((await req('POST', '/api/users', { username: 'sales', password: 'secret1' })).status, 409);

  const users = await (await req('GET', '/api/users')).json();
  assert.deepStrictEqual(users.map(x => x.username), ['admin', 'sales']);

  // sign in as the viewer
  const login = await req('POST', '/login', { u: 'sales', p: 'secret1' });
  assert.strictEqual(login.status, 200);
  const vc = login.headers.get('set-cookie').split(';')[0];
  const asViewer = (m, url, body) => req(m, url, body, { cookie: vc });

  const me = await (await asViewer('GET', '/api/me')).json();
  assert.strictEqual(me.role, 'viewer');
  const list = await (await asViewer('GET', '/api/accounts')).json();
  assert.deepStrictEqual(list.map(x => x.id), [a1.id], 'only the assigned card');
  assert.strictEqual((await asViewer('GET', '/api/accounts/' + a1.id)).status, 200);
  assert.ok((await (await asViewer('GET', '/api/accounts/' + a1.id)).json()).stats, 'stats included');
  assert.strictEqual((await asViewer('GET', '/api/accounts/' + a2.id)).status, 404, 'other cards hidden');

  for (const [m, url, body] of [
    ['POST', '/api/accounts', { name: 'Hack' }], ['PUT', '/api/accounts/' + a1.id, a1], ['DELETE', '/api/accounts/' + a1.id],
    ['PUT', '/api/brand', { logo: '' }], ['POST', '/api/media', { data: PNG }], ['POST', '/api/vcard', { text: 'BEGIN:VCARD\nEND:VCARD' }],
    ['POST', '/api/preview', a1], ['GET', '/api/users'], ['POST', '/api/users', { username: 'evil', password: '123456', role: 'admin' }],
    ['PUT', '/api/users/sales', { role: 'admin' }], ['DELETE', '/api/users/sales'],
  ]) assert.strictEqual((await asViewer(m, url, body)).status, 403, `${m} ${url} must be refused`);
  assert.ok(await (await req('GET', '/api/accounts/' + a1.id)).json(), 'account still exists');
  assert.strictEqual((await asViewer('GET', '/admin')).status, 200);

  // the viewer changes their own password; old password stops working
  assert.strictEqual((await asViewer('POST', '/api/me/password', { current: 'wrong', next: 'newpass1' })).status, 400);
  r = await asViewer('POST', '/api/me/password', { current: 'secret1', next: 'newpass1' });
  assert.strictEqual(r.status, 200);
  const vc2 = r.headers.get('set-cookie').split(';')[0];
  assert.strictEqual((await asViewer('GET', '/api/me')).status, 401, 'old session signed out');
  assert.strictEqual((await req('GET', '/api/me', null, { cookie: vc2 })).status, 200, 'new cookie works');
  assert.strictEqual((await req('POST', '/login', { u: 'sales', p: 'secret1' })).status, 401);

  // admin widens access to all cards, then promotes and deletes
  await req('PUT', '/api/users/sales', { accounts: 'all' });
  assert.strictEqual((await (await req('GET', '/api/accounts', null, { cookie: vc2 })).json()).length >= 2, true);
  await req('PUT', '/api/users/sales', { role: 'admin' });
  assert.strictEqual((await req('POST', '/api/accounts', { name: 'By Sales' }, { cookie: vc2 })).status, 201, 'promoted user can edit at once');
  assert.strictEqual((await req('DELETE', '/api/users/sales', null, { cookie: vc2 })).status, 400, 'cannot delete yourself');
  assert.strictEqual((await req('PUT', '/api/users/sales', { role: 'viewer' }, { cookie: vc2 })).status, 400, 'cannot demote yourself');
  assert.strictEqual((await req('DELETE', '/api/users/sales')).status, 200);
  assert.strictEqual((await req('GET', '/api/me', null, { cookie: vc2 })).status, 401, 'deleted user signed out');
});

test('save contact: vCard served with contact headers (upload and hosted link)', async () => {
  const VC = 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Yiha Yimam\r\nTEL:+251900000000\r\nEND:VCARD\r\n';
  assert.strictEqual((await req('POST', '/api/vcard', { text: '<html>nope</html>' })).status, 400);
  const up = await (await req('POST', '/api/vcard', { text: VC })).json();
  assert.match(up.url, /^\/media\/[a-f0-9]{32}$/);

  const a = await (await req('POST', '/api/accounts', { name: 'Vcard Person' })).json();
  a.blocks[0].vcf = up.url; a.blocks[0].vcfName = 'yiha.vcf';
  await req('PUT', '/api/accounts/' + a.id, a);
  const page = await (await req('GET', '/' + a.slug)).text();
  assert.match(page, /data-vcf href="\/vcf\//);
  assert.match(page, /id="vh"/, 'Android hint included');

  let r = await req('GET', `/vcf/${a.id}/${a.blocks[0].id}?s=nfc`, null, { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/129' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get('content-type'), 'text/x-vcard; charset=utf-8');
  assert.match(r.headers.get('content-disposition'), /^inline; filename="Vcard Person\.vcf"/);
  assert.strictEqual(await r.text(), VC);

  // A vCard hosted elsewhere with a wrong content type is passed on with the right one.
  const host = http.createServer((q, s) => {
    if (q.url === '/card.vcf') { s.writeHead(200, { 'Content-Type': 'application/octet-stream' }); return s.end(VC); }
    s.writeHead(200, { 'Content-Type': 'text/html' }); s.end('<html>login page</html>');
  }).listen(0);
  const hb = `http://127.0.0.1:${host.address().port}`;
  try {
    a.blocks[0].vcf = ''; a.blocks[0].url = hb + '/card.vcf';
    await req('PUT', '/api/accounts/' + a.id, a);
    r = await req('GET', `/vcf/${a.id}/${a.blocks[0].id}`);
    assert.strictEqual(r.headers.get('content-type'), 'text/x-vcard; charset=utf-8');
    assert.strictEqual(await r.text(), VC);

    a.blocks[0].url = hb + '/not-a-vcard';
    await req('PUT', '/api/accounts/' + a.id, a);
    r = await req('GET', `/vcf/${a.id}/${a.blocks[0].id}`);
    assert.strictEqual(r.status, 302, 'non-vCard content is never passed on');
    assert.strictEqual(r.headers.get('location'), hb + '/not-a-vcard');
  } finally { host.close(); }

  const { directUrl } = require('../src/services/vcard');
  assert.strictEqual(directUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view?usp=sharing'), 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMn');
  assert.strictEqual(directUrl('https://www.dropbox.com/s/x/card.vcf?dl=0'), 'https://www.dropbox.com/s/x/card.vcf?dl=1');
});

test('branding: footer text and logo size are saved and shown on pages', async () => {
  let b = await (await req('GET', '/api/brand')).json();
  assert.strictEqual(b.text, 'Powered by Shaggar BPO Enterprise');
  assert.strictEqual(b.logoSize, 18);
  let r = await req('PUT', '/api/brand', { text: '  Made by <Acme>  Ltd ', logoSize: 500 });
  b = await r.json();
  assert.strictEqual(b.text, 'Made by <Acme> Ltd');
  assert.strictEqual(b.logoSize, 60, 'size is clamped');
  r = await req('PUT', '/api/brand', { logo: PNG });
  b = await r.json();
  assert.match(b.logo, /^\/media\//);
  assert.strictEqual(b.text, 'Made by <Acme> Ltd', 'logo upload keeps the text');
  const pub = await (await fetch(base + '/brand.json')).json();
  assert.strictEqual(pub.text, 'Made by <Acme> Ltd');
  const accs = await (await req('GET', '/api/accounts')).json();
  if (accs.length) {
    const page = await (await fetch(base + '/' + accs[0].slug)).text();
    assert.match(page, /Made by &lt;Acme&gt; Ltd/);
    assert.match(page, /height:60px/);
  }
  await req('PUT', '/api/brand', { text: '' });
  assert.strictEqual((await (await req('GET', '/api/brand')).json()).text, '', 'empty text hides the statement');
  await req('PUT', '/api/brand', { text: 'Powered by Shaggar BPO Enterprise', logoSize: 18, logo: '' });
});
