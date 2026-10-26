// Companies: company page, shared design and logo, card template, cards one by one and from Excel,
// sign-ins file, company admin permissions.
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'test-pass';
const fs = require('fs');
const os = require('os');
const CLIENT = fs.mkdtempSync(require('path').join(os.tmpdir(), 'sbpo-client-'));
fs.writeFileSync(CLIENT + '/index.html', '<div id="app"></div>');
fs.writeFileSync(CLIENT + '/login.html', '<div id="login"></div>');
process.env.CLIENT_DIR = CLIENT;

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const database = require('../src/db');
const { fakeDb } = require('./fake-mongo');
const auth = require('../src/services/auth');
const xlsx = require('../src/services/xlsx');
const { createApp } = require('../src/app');
const DEF = require('../src/config').defaultUserPassword;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let server, base, cookie = '';
const req = (method, url, body, extra = {}) => fetch(base + url, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', cookie, ...extra }, body: body ? JSON.stringify(body) : undefined });
const J = async (...a) => (await req(...a)).json();
const signIn = async (u, p) => { const r = await req('POST', '/login', { u, p }, { cookie: '' }); assert.strictEqual(r.status, 200, `login ${u}`); return r.headers.get('set-cookie').split(';')[0]; };

before(async () => {
  database.use(fakeDb());
  await database.ensureIndexes();
  await auth.init();
  server = http.createServer(createApp()).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  cookie = await signIn('admin', 'test-pass');
});
after(() => { server.close(); fs.rmSync(CLIENT, { recursive: true, force: true }); });

let co, amina;

test('create a company: company page, company admin sign-in, address rules', async () => {
  let r = await req('POST', '/api/companies', { name: '' });
  assert.strictEqual(r.status, 400);
  r = await req('POST', '/api/companies', { name: 'Acme Trading' });
  assert.strictEqual(r.status, 201);
  co = await r.json();
  assert.strictEqual(co.slug, 'acme-trading');
  assert.deepStrictEqual(co.login, { username: 'acme-trading', password: DEF });

  // individual cards and companies share the top-level addresses
  const ind = await J('POST', '/api/accounts', { name: 'Acme Trading' });
  assert.strictEqual(ind.slug, 'acme-trading-2', 'an individual card cannot take a company address');
  const co2 = await J('POST', '/api/companies', { name: 'Acme Trading' });
  assert.strictEqual(co2.slug, 'acme-trading-3');
  await req('DELETE', '/api/companies/' + co2.id);
  await req('DELETE', '/api/accounts/' + ind.id);

  // company page content + logo
  const page = await J('GET', `/api/companies/${co.id}/page`);
  assert.strictEqual(page.kind, 'page');
  page.profile.title = 'Trading since 1990';
  page.profile.bio = 'We trade things.';
  page.profile.logo = PNG;
  page.fields = { website: 'acme.example', phone: '+251 111 22 33', address: '' };
  page.ownDesign = true; // the company page gets its own design
  page.theme.pageBg = '#123456';
  r = await req('PUT', `/api/companies/${co.id}/page`, page);
  assert.strictEqual(r.status, 200);
  const html = await (await req('GET', '/acme-trading', null, { cookie: '' })).text();
  assert.match(html, /class="clg"[^>]*src="\/media\/[a-f0-9]{32}"/, 'logo in the center');
  assert.match(html, /Trading since 1990/);
  assert.match(html, /#123456/);
  assert.match(html, /Visit our website/);
  assert.match(html, /Call us/);
  assert.doesNotMatch(html, /Email us|Find us/, 'links without a value are hidden');
});

test('cards under the company follow the company design and logo', async () => {
  // card design (template): placeholders + design
  const tpl = await J('GET', `/api/companies/${co.id}/template`);
  assert.strictEqual(tpl.kind, 'template');
  assert.ok(tpl.profile.logo.startsWith('/media/'), 'template shows the company logo');
  tpl.theme.linkBg = '#aa0000';
  tpl.profile.department = 'Sales';
  tpl.blocks[1].items.push({ id: 'tg', ico: 'telegram', title: 'Telegram', url: 'https://t.me/{telegram}' });
  assert.strictEqual((await req('PUT', `/api/companies/${co.id}/template`, tpl)).status, 200);

  let r = await req('POST', `/api/companies/${co.id}/members`, { name: 'Amina Hassan', title: 'CEO', fields: { phone: '+251 911 22 33 44', email: 'amina@acme.example' } });
  assert.strictEqual(r.status, 201);
  amina = await r.json();
  assert.strictEqual(amina.path, 'acme-trading/amina-hassan');
  assert.deepStrictEqual(amina.login, { username: 'acme-trading.amina-hassan', password: DEF });
  assert.strictEqual(amina.profile.department, 'Sales', 'default department from the template');

  let html = await (await req('GET', '/acme-trading/amina-hassan', null, { cookie: '' })).text();
  assert.match(html, /Amina Hassan/);
  assert.match(html, /#aa0000/, 'company design');
  assert.match(html, /class="lgc"/, 'company logo in the corner');
  assert.match(html, /Call me/);
  assert.match(html, /Email me/);
  assert.doesNotMatch(html, /WhatsApp|Telegram/, 'no WhatsApp / Telegram value: buttons hidden');
  assert.strictEqual((await req('GET', '/n/acme-trading/amina-hassan', null, { cookie: '' })).status, 200);
  assert.strictEqual((await req('GET', '/amina-hassan', null, { cookie: '' })).status, 404, 'company cards live under the company address');

  // links fill in the person's details
  const card = await J('GET', '/api/accounts/' + amina.id);
  const call = card.blocks[1].items.find(i => i.title === 'Call me');
  r = await req('GET', `/go/${amina.id}/${call.id}`, null, { cookie: '' });
  assert.strictEqual(r.headers.get('location'), 'tel:+251911223344');
  // automatic vCard from the details
  const contact = card.blocks.find(b => b.type === 'contact');
  r = await req('GET', `/vcf/${amina.id}/${contact.id}`, null, { cookie: '' });
  const vcf = await r.text();
  assert.match(r.headers.get('content-type'), /vcard/);
  assert.match(vcf, /FN:Amina Hassan/);
  assert.match(vcf, /TITLE:CEO/);
  assert.match(vcf, /ORG:Acme Trading;Sales/);
  assert.match(vcf, /EMAIL;TYPE=INTERNET:amina@acme.example/);

  // the company design changes reach every card that follows it
  tpl.theme.linkBg = '#00aa00';
  await req('PUT', `/api/companies/${co.id}/template`, tpl);
  html = await (await req('GET', '/acme-trading/amina-hassan', null, { cookie: '' })).text();
  assert.match(html, /#00aa00/);

  // the logo can't be changed on the card
  card.profile.logo = PNG.replace('ggg', 'ggh');
  card.profile.name = 'Amina H.';
  assert.strictEqual((await req('PUT', '/api/accounts/' + amina.id, card)).status, 200);
  const after = await J('GET', '/api/accounts/' + amina.id);
  assert.strictEqual(after.profile.name, 'Amina H.');
  assert.strictEqual(after.profile.logo, tpl.profile.logo, 'still the company logo');

  // own design for one card, then back to the company design
  after.ownDesign = true;
  after.theme.linkBg = '#0000bb';
  await req('PUT', '/api/accounts/' + amina.id, after);
  html = await (await req('GET', '/acme-trading/amina-hassan', null, { cookie: '' })).text();
  assert.match(html, /#0000bb/);
  tpl.theme.linkBg = '#777777';
  await req('PUT', `/api/companies/${co.id}/template`, tpl);
  assert.match(await (await req('GET', '/acme-trading/amina-hassan', null, { cookie: '' })).text(), /#0000bb/, 'own design is kept');
  after.ownDesign = false;
  await req('PUT', '/api/accounts/' + amina.id, after);
  assert.match(await (await req('GET', '/acme-trading/amina-hassan', null, { cookie: '' })).text(), /#777777/);

  // the company page lists the team
  html = await (await req('GET', '/acme-trading', null, { cookie: '' })).text();
  assert.match(html, /Our team/);
  assert.match(html, /href="\/acme-trading\/amina-hassan\?s=company"/);
});

test('card design: logo size & position, company page with or without its own design, custom choices', async () => {
  // The logo's look on the cards is set in the card design; the company page keeps the logo image.
  const tpl = await J('GET', `/api/companies/${co.id}/template`);
  Object.assign(tpl.profile, { logoPos: 'bc', logoSize: 60, logoBg: false });
  tpl.theme = { ...tpl.theme, picShape: 'square', bgType: 'image', bgImage: PNG, bgSize: 'zoom', bgZoom: 80, bgPos: 'top right', bgDim: 40, gap: 20, btnSize: 'l', disp: 'Sora',
    mode: { colors: 'Custom', fonts: 'Custom' }, cust: { colors: { linkBg: '#abcdef' }, fonts: { disp: 'Sora', body: 'Nope' } } };
  assert.strictEqual((await req('PUT', `/api/companies/${co.id}/template`, tpl)).status, 200);
  const back = await J('GET', `/api/companies/${co.id}/template`);
  assert.strictEqual(back.profile.logoPos, 'bc');
  assert.strictEqual(back.profile.logoSize, 60);
  assert.ok(back.profile.logo.startsWith('/media/'), 'the company logo is still there');
  assert.deepStrictEqual(back.theme.mode, { colors: 'Custom', fonts: 'Custom' });
  assert.deepStrictEqual(back.theme.cust.fonts, { disp: 'Sora', body: 'Inter' }, 'unknown fonts are replaced');
  assert.strictEqual(back.theme.disp, 'Sora');
  const html = await (await req('GET', '/acme-trading/amina-hassan', null, { cookie: '' })).text();
  assert.match(html, /class="hd">.*<\/div><div class="lgbt">/, 'logo under the name and title');
  assert.match(html, /lgc nb/, 'no white card behind the logo');
  assert.match(html, /top right\/80% auto no-repeat/, 'background image size and position');
  assert.match(html, /rgba\(0,0,0,0\.4\)/, 'background darkened');
  assert.match(html, /family=Sora/);
  // The company page follows the company design (the first test gave it its own: switch back)...
  let page = await J('GET', `/api/companies/${co.id}/page`);
  page.ownDesign = false;
  await req('PUT', `/api/companies/${co.id}/page`, page);
  page = await J('GET', `/api/companies/${co.id}/page`);
  assert.strictEqual(page.ownDesign, false);
  assert.strictEqual(page.theme.disp, 'Sora');
  // ...its own changes don't touch the card design while it follows it...
  page.theme.linkBg = '#010203';
  await req('PUT', `/api/companies/${co.id}/page`, page);
  assert.notStrictEqual((await J('GET', `/api/companies/${co.id}/template`)).theme.linkBg, '#010203');
  // ...until it gets its own design.
  page.ownDesign = true;
  page.theme.picShape = 'circle';
  await req('PUT', `/api/companies/${co.id}/page`, page);
  page = await J('GET', `/api/companies/${co.id}/page`);
  assert.strictEqual(page.ownDesign, true);
  assert.strictEqual(page.theme.linkBg, '#010203');
  assert.notStrictEqual((await J('GET', `/api/companies/${co.id}/template`)).theme.linkBg, '#010203', 'the cards keep the company design');
  assert.match(await (await req('GET', '/acme-trading', null, { cookie: '' })).text(), /class="clg ci"/, 'circular logo on the company page');
  // Changing the logo in the card design changes the company logo.
  back.profile.logo = '';
  await req('PUT', `/api/companies/${co.id}/template`, back);
  assert.strictEqual((await J('GET', `/api/companies/${co.id}/page`)).profile.logo, '');
});

test('Excel: template, import, sign-ins file', async () => {
  let r = await req('GET', `/api/companies/${co.id}/template.xlsx`);
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /acme-trading-people-template\.xlsx/);
  const head = xlsx.read(Buffer.from(await r.arrayBuffer()))[0];
  assert.deepStrictEqual(head.slice(0, 5), ['Full name', 'Job title', 'Department', 'Phone', 'Email']);
  assert.ok(head.includes('telegram'), 'extra placeholder of the template becomes a column');

  const file = xlsx.write([{ name: 'People', rows: [
    head,
    ['Kebede Alemu', 'Sales Lead', '', '0911 000111', 'kebede@acme.example', '+251911000111', '', '', '', '', '', 'kebede_tg'],
    ['', 'No name here'],
    ['Sara Tesfaye', 'Accountant', 'Finance', '', '', '', '', 'https://linkedin.com/in/sara', '', '', 'sara'],
    ['Amina H.', '', '', '', '', '', '', '', '', '', 'amina-hassan'],
    ['Kebede Alemu', 'Another Kebede'],
  ] }]);
  r = await req('POST', `/api/companies/${co.id}/import`, { data: file.toString('base64') });
  assert.strictEqual(r.status, 200);
  const res = await r.json();
  assert.deepStrictEqual(res.created.map(x => x.slug), ['kebede-alemu', 'sara', 'kebede-alemu-2']);
  assert.deepStrictEqual(res.skipped.map(x => x.line), [3, 5], 'no name, and already existing card');
  assert.ok(res.created.every(x => x.password === DEF && x.username.startsWith('acme-trading.')));

  let html = await (await req('GET', '/acme-trading/kebede-alemu', null, { cookie: '' })).text();
  assert.match(html, /Sales Lead/);
  assert.match(html, /WhatsApp/);
  assert.match(html, /Telegram/);
  html = await (await req('GET', '/acme-trading/sara', null, { cookie: '' })).text();
  assert.match(html, /LinkedIn/);
  assert.doesNotMatch(html, /Call me/);
  const sara = res.created.find(x => x.slug === 'sara');
  const li = (await J('GET', '/api/accounts/' + sara.id)).blocks[1].items.find(i => i.title === 'LinkedIn');
  assert.strictEqual((await req('GET', `/go/${sara.id}/${li.id}`, null, { cookie: '' })).headers.get('location'), 'https://linkedin.com/in/sara');

  // CSV works too, and a sheet without a name column is refused
  r = await req('POST', `/api/companies/${co.id}/import`, { data: Buffer.from('Name;Phone\nAbel Girma;0911\n').toString('base64') });
  assert.deepStrictEqual((await r.json()).created.map(x => x.slug), ['abel-girma']);
  r = await req('POST', `/api/companies/${co.id}/import`, { data: Buffer.from('Phone\n0911\n').toString('base64') });
  assert.strictEqual(r.status, 400);

  r = await req('GET', `/api/companies/${co.id}/sign-ins.xlsx`);
  const rows = xlsx.read(Buffer.from(await r.arrayBuffer()));
  assert.strictEqual(rows[0][4], 'Username');
  assert.match(rows[1][0], /company admin/);
  assert.strictEqual(rows[1][4], 'acme-trading');
  assert.strictEqual(rows.length, 2 + 5, 'company admin + 5 cards');
  assert.ok(rows.slice(1).every(x => x[5] === DEF));
  assert.match(rows.find(x => x[0] === 'Sara Tesfaye')[2], /\/acme-trading\/sara$/);
});

test('company admin: company totals and each card, nothing else', async () => {
  const other = await J('POST', '/api/accounts', { name: 'Outside Person' });
  await req('GET', '/acme-trading/amina-hassan', null, { cookie: '' });
  await req('GET', '/n/acme-trading/sara', null, { cookie: '' });

  let cc = await signIn('acme-trading', DEF);
  const as = (m, u, b) => req(m, u, b, { cookie: cc });
  assert.strictEqual((await as('GET', '/api/companies')).status, 403, 'must choose a password first');
  const r = await as('POST', '/api/me/password', { next: 'acme-secret' });
  cc = r.headers.get('set-cookie').split(';')[0];

  const me = await (await as('GET', '/api/me')).json();
  assert.strictEqual(me.company, co.id);
  const list = await (await as('GET', '/api/companies')).json();
  assert.deepStrictEqual(list.map(c => c.id), [co.id]);
  assert.strictEqual(list[0].members, 5);
  const d = await (await as('GET', '/api/companies/' + co.id)).json();
  assert.strictEqual(d.members.length, 5);
  assert.ok(!('adminLogin' in d) && !('login' in d.members[0]), 'no sign-in details for the company admin');
  assert.ok(d.stats.views >= 2 && d.stats.taps >= 1, 'combined totals');
  assert.strictEqual((await as('GET', '/api/accounts/' + amina.id)).status, 200, 'can open each card');
  assert.strictEqual((await as('GET', '/api/accounts/' + other.id)).status, 404, 'not cards of other companies');
  const accs = await (await as('GET', '/api/accounts')).json();
  assert.ok(accs.every(a => a.companyId === co.id));
  for (const [m, u, b] of [
    ['PUT', '/api/accounts/' + amina.id, {}], ['POST', `/api/companies/${co.id}/members`, { name: 'X' }], ['GET', `/api/companies/${co.id}/page`],
    ['PUT', `/api/companies/${co.id}/template`, {}], ['POST', `/api/companies/${co.id}/import`, { data: '' }], ['GET', `/api/companies/${co.id}/sign-ins.xlsx`],
    ['DELETE', '/api/companies/' + co.id], ['POST', '/api/companies', { name: 'Mine' }],
  ]) assert.strictEqual((await as(m, u, b)).status, 403, `${m} ${u}`);

  // a card owner of the company sees only their own card
  const oc = await signIn('acme-trading.amina-hassan', DEF);
  assert.strictEqual((await req('GET', '/api/companies/' + co.id, null, { cookie: oc })).status, 403);
});

test('deleting the company removes its cards and sign-ins', async () => {
  const before = (await J('GET', '/api/users')).length;
  assert.strictEqual((await req('DELETE', '/api/companies/' + co.id)).status, 200);
  assert.strictEqual((await req('GET', '/acme-trading', null, { cookie: '' })).status, 404);
  assert.strictEqual((await req('GET', '/acme-trading/sara', null, { cookie: '' })).status, 404);
  assert.strictEqual((await req('GET', '/api/accounts/' + amina.id)).status, 404);
  assert.strictEqual((await J('GET', '/api/users')).length, before - 6);
});
