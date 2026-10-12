// JSON API used by the admin app.
// Every route needs a signed-in user. Viewers may only read statistics (the routes marked
// "everyone" below); everything after the admin-only guard needs the admin role.
const config = require('../config');
const auth = require('../services/auth');
const accounts = require('../repositories/accounts');
const usersRepo = require('../repositories/users');
const vcard = require('../services/vcard');
const events = require('../repositories/events');
const stats = require('../services/stats');
const media = require('../services/media');
const brand = require('../services/brand');
const { renderPage } = require('../services/render');
const { S, clean, newAccount, slugify, validSlug, RESERVED, ICONS, DATA_URL } = require('../services/sanitize');
const { json, html, readJson } = require('../lib/http');

async function freeSlug(wanted) {
  let slug = slugify(wanted) || 'card';
  if (slug.length < 2) slug += '-1';
  const base = slug;
  for (let i = 2; RESERVED.includes(slug) || (await accounts.slugTaken(slug)); i++) slug = `${base}-${i}`;
  return slug;
}

const USERNAME = /^[a-z0-9._-]{3,32}$/;
const forbidden = res => json(res, { error: 'forbidden', message: 'Only an admin can do that.' }, 403);

// Normalises the "which cards can this viewer see" field: 'all' or a list of existing account ids.
async function accessList(v) {
  if (v === 'all' || !Array.isArray(v)) return 'all';
  const known = new Set((await accounts.list()).map(a => a.id));
  return [...new Set(v.map(String))].filter(id => known.has(id));
}

module.exports = router => {
  router.all('/api/*', async (req, res) => ((await auth.currentUser(req)) ? false : json(res, { error: 'auth' }, 401)));

  /* ---------- everyone who is signed in (admins and viewers) ---------- */

  router.get('/api/me', (req, res) => json(res, auth.publicUser(req._user)));

  router.post('/api/me/password', async (req, res) => {
    const u = req._user, b = (await readJson(req, 1e4)) || {};
    if (u.builtin) return json(res, { error: 'builtin', message: 'The main admin password is set in server/.env (ADMIN_PASSWORD).' }, 400);
    if (!auth.checkPassword(String(b.current ?? ''), u)) return json(res, { error: 'bad', message: 'Your current password is not correct.' }, 400);
    const next = String(b.next ?? '');
    if (next.length < 6) return json(res, { error: 'short', message: 'Use at least 6 characters.' }, 400);
    const fields = { ...auth.hashPassword(next), ver: (u.ver || 0) + 1 };
    await usersRepo.update(u.username, fields);
    json(res, { ok: true }, 200, { 'Set-Cookie': auth.makeCookie(req, { ...u, ...fields }) });
  });

  router.get('/api/accounts', async (req, res) => {
    const [list, st] = await Promise.all([accounts.list(), stats.listStats()]);
    json(res, list.filter(a => auth.canSee(req._user, a.id)).map(a => ({
      id: a.id, slug: a.slug, name: a.profile.name, title: a.profile.title, company: a.profile.company,
      photo: a.profile.photo || '', created: a.created, ...(st[a.id] || stats.blank()),
    })));
  });

  router.get('/api/accounts/:id', async (req, res, { params }) => {
    const a = await accounts.get(params.id);
    if (!a || !auth.canSee(req._user, a.id)) return json(res, { error: 'nf' }, 404);
    json(res, { ...a, stats: await stats.detail(a) });
  });

  router.get('/api/icons', (req, res) => json(res, ICONS, 200, { 'Cache-Control': 'max-age=3600' }));
  router.get('/api/brand', async (req, res) => json(res, await brand.get()));

  /* ---------- admins only from here on ---------- */
  router.all('/api/*', (req, res) => (auth.isAdmin(req._user) ? false : forbidden(res)));

  router.get('/api/users', async (req, res) => {
    const list = await usersRepo.list();
    json(res, [auth.publicUser({ username: config.adminUser, name: 'Main admin', role: 'admin', accounts: 'all', builtin: true }), ...list.map(auth.publicUser)]);
  });

  router.post('/api/users', async (req, res) => {
    const b = (await readJson(req, 1e5)) || {};
    const username = S(b.username, 40).trim().toLowerCase();
    if (!USERNAME.test(username)) return json(res, { error: 'username', message: 'Username: 3–32 letters, numbers, dots, dashes or underscores.' }, 400);
    if (username === config.adminUser.toLowerCase() || (await usersRepo.get(username))) return json(res, { error: 'taken', message: 'That username is already in use.' }, 409);
    const password = String(b.password ?? '');
    if (password.length < 6) return json(res, { error: 'short', message: 'The password needs at least 6 characters.' }, 400);
    const role = auth.ROLES.includes(b.role) ? b.role : 'viewer';
    const u = {
      username, name: S(b.name, 80).trim() || username, role,
      accounts: role === 'admin' ? 'all' : await accessList(b.accounts),
      ...auth.hashPassword(password), ver: 0, created: Date.now(),
    };
    try { await usersRepo.insert(u); } catch (e) {
      if (e && e.code === 11000) return json(res, { error: 'taken', message: 'That username is already in use.' }, 409);
      throw e;
    }
    json(res, auth.publicUser(u), 201);
  });

  router.put('/api/users/:username', async (req, res, { params }) => {
    const u = await usersRepo.get(params.username);
    if (!u) return json(res, { error: 'nf', message: 'The main admin is managed in server/.env.' }, 404);
    const b = (await readJson(req, 1e5)) || {};
    const role = auth.ROLES.includes(b.role) ? b.role : u.role;
    if (u.username === req._user.username && role !== 'admin') return json(res, { error: 'self', message: 'You can’t remove your own admin access.' }, 400);
    const fields = { name: S(b.name ?? u.name, 80).trim() || u.username, role, accounts: role === 'admin' ? 'all' : await accessList(b.accounts ?? u.accounts) };
    if (b.password) {
      if (String(b.password).length < 6) return json(res, { error: 'short', message: 'The password needs at least 6 characters.' }, 400);
      Object.assign(fields, auth.hashPassword(String(b.password)), { ver: (u.ver || 0) + 1 }); // signs the user out everywhere
    }
    await usersRepo.update(u.username, fields);
    json(res, auth.publicUser({ ...u, ...fields }));
  });

  router.delete('/api/users/:username', async (req, res, { params }) => {
    const u = await usersRepo.get(params.username);
    if (!u) return json(res, { error: 'nf', message: 'The main admin can’t be deleted.' }, 404);
    if (u.username === req._user.username) return json(res, { error: 'self', message: 'You can’t delete yourself.' }, 400);
    await usersRepo.remove(u.username);
    json(res, { ok: true });
  });

  router.post('/api/accounts', async (req, res) => {
    const b = (await readJson(req, 1e4)) || {};
    const name = S(b.name, 80).trim();
    if (!name) return json(res, { error: 'name', message: 'Please enter a name.' }, 400);
    if (b.slug && !validSlug(slugify(b.slug))) return json(res, { error: 'slug', message: 'That page address is not allowed. Use 2–40 letters, numbers or dashes.' }, 400);
    for (let attempt = 0; attempt < 5; attempt++) {
      const a = newAccount(name, await freeSlug(b.slug || name));
      try {
        await accounts.insert(a);
        return json(res, a, 201);
      } catch (e) {
        if (e && e.code === 11000) continue; // slug taken by a parallel request, try the next one
        throw e;
      }
    }
    return json(res, { error: 'slug', message: 'Could not find a free page address, try another one.' }, 409);
  });

  router.put('/api/accounts/:id', async (req, res, { params }) => {
    const old = await accounts.get(params.id);
    if (!old) return json(res, { error: 'nf' }, 404);
    const b = await readJson(req);
    if (!b) return json(res, { error: 'bad' }, 400);
    const a = clean(b, old);
    if (a.slug !== old.slug && (await accounts.slugTaken(a.slug, a.id))) a.slug = old.slug;
    await media.ingestAccount(a);
    try {
      await accounts.replace(a);
    } catch (e) {
      if (!(e && e.code === 11000)) throw e;
      a.slug = old.slug;
      await accounts.replace(a);
    }
    json(res, { ok: true, slug: a.slug });
  });

  router.delete('/api/accounts/:id', async (req, res, { params }) => {
    const a = await accounts.get(params.id);
    if (!a) return json(res, { error: 'nf' }, 404);
    await accounts.remove(a.id);
    await events.removeFor(a.id);
    media.collectGarbage().catch(() => {});
    json(res, { ok: true });
  });

  router.put('/api/brand', async (req, res) => {
    const b = (await readJson(req, 3e6)) || {};
    const r = await brand.update({ logo: b.logo, logoSize: b.logoSize, text: b.text });
    json(res, { ok: true, ...r });
  });

  // Upload one image (data: URL) and get back a short "/media/<id>" URL to store in the account.
  router.post('/api/media', async (req, res) => {
    const b = (await readJson(req, 3e6)) || {};
    if (typeof b.data !== 'string' || !DATA_URL.test(b.data)) return json(res, { error: 'bad', message: 'Unsupported image.' }, 400);
    const url = await media.store(b.data);
    if (!url) return json(res, { error: 'size', message: 'Image is too large.' }, 413);
    json(res, { url });
  });

  // Upload a .vcf file for a "Save contact" button. Stored like an image and served by /vcf/... with the right headers.
  router.post('/api/vcard', async (req, res) => {
    const b = (await readJson(req, 3e6)) || {};
    const r = await vcard.storeUpload(b.text);
    if (r.error) return json(res, r, 400);
    json(res, r);
  });

  router.post('/api/preview', async (req, res) => {
    const b = await readJson(req);
    if (!b) return json(res, { error: 'bad' }, 400);
    const a = clean(b, { id: S(b.id, 20) || 'x', slug: '', created: 0 });
    html(res, renderPage(a, { src: 'preview', preview: true, brand: await brand.get() }));
  });

  router.all('/api/*', (req, res) => json(res, { error: 'nf' }, 404));
};
