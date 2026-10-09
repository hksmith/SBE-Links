// JSON API used by the admin app. Every route here requires a logged-in admin.
const auth = require('../services/auth');
const accounts = require('../repositories/accounts');
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

module.exports = router => {
  router.all('/api/*', (req, res) => (auth.isLoggedIn(req) ? false : json(res, { error: 'auth' }, 401)));

  router.get('/api/accounts', async (req, res) => {
    const [list, st] = await Promise.all([accounts.list(), stats.listStats()]);
    json(res, list.map(a => ({
      id: a.id, slug: a.slug, name: a.profile.name, title: a.profile.title, company: a.profile.company,
      photo: a.profile.photo || '', created: a.created, ...(st[a.id] || stats.blank()),
    })));
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

  router.get('/api/accounts/:id', async (req, res, { params }) => {
    const a = await accounts.get(params.id);
    if (!a) return json(res, { error: 'nf' }, 404);
    json(res, { ...a, stats: await stats.detail(a) });
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

  router.get('/api/icons', (req, res) => json(res, ICONS, 200, { 'Cache-Control': 'max-age=3600' }));

  router.get('/api/brand', async (req, res) => json(res, { logo: await brand.logo() }));
  router.put('/api/brand', async (req, res) => {
    const b = (await readJson(req, 3e6)) || {};
    await brand.setLogo(b.logo);
    json(res, { ok: true, logo: await brand.logo() });
  });

  // Upload one image (data: URL) and get back a short "/media/<id>" URL to store in the account.
  router.post('/api/media', async (req, res) => {
    const b = (await readJson(req, 3e6)) || {};
    if (typeof b.data !== 'string' || !DATA_URL.test(b.data)) return json(res, { error: 'bad', message: 'Unsupported image.' }, 400);
    const url = await media.store(b.data);
    if (!url) return json(res, { error: 'size', message: 'Image is too large.' }, 413);
    json(res, { url });
  });

  router.post('/api/preview', async (req, res) => {
    const b = await readJson(req);
    if (!b) return json(res, { error: 'bad' }, 400);
    const a = clean(b, { id: S(b.id, 20) || 'x', slug: '', created: 0 });
    html(res, renderPage(a, { src: 'preview', preview: true, brandLogo: await brand.logo() }));
  });

  router.all('/api/*', (req, res) => json(res, { error: 'nf' }, 404));
};
