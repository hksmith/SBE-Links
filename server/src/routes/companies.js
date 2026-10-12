// Company API. forViewers: what a company admin (and admins) may read. forAdmins: everything that changes something.
const auth = require('../services/auth');
const config = require('../config');
const accounts = require('../repositories/accounts');
const companiesRepo = require('../repositories/companies');
const usersRepo = require('../repositories/users');
const companies = require('../services/companies');
const owners = require('../services/owners');
const pages = require('../services/pages');
const stats = require('../services/stats');
const media = require('../services/media');
const { S, clean, slugify, validSlug } = require('../services/sanitize');
const { json, readJson, origin, sendFile } = require('../lib/http');

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const asCompany = c => ({ ...c, isCompany: true });
const logoOf = c => c.page.profile.logo || '';

// Loads the company in :id and checks the signed-in user may see it.
async function load(req, res, id) {
  const c = await companiesRepo.get(id);
  if (!c || !auth.canSee(req._user, asCompany(c))) { json(res, { error: 'nf', message: 'Company not found.' }, 404); return null; }
  return c;
}

// The company's sign-in for its company admin.
const adminLogin = (users, c) => {
  const u = users.find(x => x.company === c.id);
  return u ? { username: u.username, mustChange: !!u.mustChange, ...(u.mustChange ? { password: config.defaultUserPassword } : {}) } : null;
};

function forViewers(router) {
  // Companies the user can see, with totals over the company page and all its cards.
  router.get('/api/companies', async (req, res) => {
    const [list, all, st] = await Promise.all([companiesRepo.list(), accounts.list(), stats.listStats()]);
    json(res, list.filter(c => auth.canSee(req._user, asCompany(c))).map(c => {
      const members = all.filter(a => a.company === c.id);
      const tot = stats.sum([st[c.id], ...members.map(a => st[a.id])]);
      return { id: c.id, slug: c.slug, name: c.name, logo: logoOf(c), created: c.created, members: members.length, views: tot.views, taps: tot.taps, clicks: tot.clicks, last: tot.last };
    }));
  });

  // One company: its people with their numbers, and the combined statistics.
  router.get('/api/companies/:id', async (req, res, { params }) => {
    const c = await load(req, res, params.id);
    if (!c) return;
    const admin = auth.isAdmin(req._user);
    const [members, st, logins, users] = await Promise.all([accounts.listByCompany(c.id), stats.listStats(), admin ? owners.loginsByAccount() : {}, admin ? usersRepo.list() : []]);
    json(res, {
      id: c.id, slug: c.slug, name: c.name, logo: logoOf(c), tagline: c.page.profile.title, created: c.created,
      page: st[c.id] || stats.blank(),
      members: members.map(a => ({
        id: a.id, slug: a.slug, path: `${c.slug}/${a.slug}`, name: a.profile.name, title: a.profile.title, department: a.profile.department,
        photo: a.profile.photo || '', ownDesign: !!a.ownDesign, created: a.created, ...(st[a.id] || stats.blank()),
        ...(admin ? { login: logins[a.id] || null } : {}),
      })),
      stats: await stats.combined([c.id, ...members.map(a => a.id)]),
      ...(admin ? { adminLogin: adminLogin(users, c) } : {}),
    });
  });
}

function forAdmins(router) {
  router.post('/api/companies', async (req, res) => {
    const b = (await readJson(req, 1e4)) || {};
    const name = S(b.name, 80).trim();
    if (!name) return json(res, { error: 'name', message: 'Please enter the company name.' }, 400);
    if (b.slug && !validSlug(slugify(b.slug))) return json(res, { error: 'slug', message: 'That page address is not allowed. Use 2–40 letters, numbers or dashes.' }, 400);
    try {
      const r = await companies.create({ name, slug: b.slug, login: b.login !== false });
      json(res, { id: r.company.id, slug: r.company.slug, name: r.company.name, login: r.login }, 201);
    } catch (e) {
      if (e.status) return json(res, { error: 'slug', message: e.message }, e.status);
      throw e;
    }
  });

  router.delete('/api/companies/:id', async (req, res, { params }) => {
    const c = await companiesRepo.get(params.id);
    if (!c) return json(res, { error: 'nf' }, 404);
    await companies.remove(c);
    media.collectGarbage().catch(() => {});
    json(res, { ok: true });
  });

  /* The company page and the card design are edited with the same editor as a card, so they are sent and
     received in the same shape: { id, profile, fields, theme, blocks } (+ slug / showTeam for the page). */

  router.get('/api/companies/:id/page', async (req, res, { params }) => {
    const c = await companiesRepo.get(params.id);
    if (!c) return json(res, { error: 'nf' }, 404);
    json(res, { ...pages.companyDoc(c), kind: 'page', showTeam: c.showTeam !== false, path: c.slug, companyInfo: { id: c.id, name: c.name, slug: c.slug }, stats: await stats.detail(c) });
  });

  router.put('/api/companies/:id/page', async (req, res, { params }) => {
    const c = await companiesRepo.get(params.id);
    if (!c) return json(res, { error: 'nf' }, 404);
    const b = await readJson(req);
    if (!b) return json(res, { error: 'bad' }, 400);
    const a = clean(b, { id: c.id, slug: c.slug, created: c.created });
    await media.ingestAccount(a);
    if (a.slug !== c.slug && !(await pages.topSlugFree(a.slug, c.id))) a.slug = c.slug;
    Object.assign(c, { slug: a.slug, name: a.profile.name.trim() || c.name, theme: a.theme, showTeam: b.showTeam !== false });
    c.page = { profile: { ...a.profile, photo: '' }, fields: a.fields, blocks: a.blocks };
    try {
      await companiesRepo.replace(c);
    } catch (e) {
      if (!(e && e.code === 11000)) throw e;
      c.slug = (await companiesRepo.get(c.id)).slug;
      await companiesRepo.replace(c);
    }
    json(res, { ok: true, slug: c.slug, path: c.slug });
  });

  router.get('/api/companies/:id/template', async (req, res, { params }) => {
    const c = await companiesRepo.get(params.id);
    if (!c) return json(res, { error: 'nf' }, 404);
    const doc = pages.inherit({ id: c.id, slug: '', created: c.created, company: c.id, ownDesign: false, profile: c.template.profile, fields: c.template.fields, blocks: c.template.blocks }, c);
    json(res, { ...doc, kind: 'template', companyInfo: { id: c.id, name: c.name, slug: c.slug }, stats: null });
  });

  router.put('/api/companies/:id/template', async (req, res, { params }) => {
    const c = await companiesRepo.get(params.id);
    if (!c) return json(res, { error: 'nf' }, 404);
    const b = await readJson(req);
    if (!b) return json(res, { error: 'bad' }, 400);
    const a = clean(b, { id: c.id, slug: '', created: c.created });
    await media.ingestAccount(a);
    for (const k of pages.LOGO_KEYS) delete a.profile[k]; // the logo is set on the company page
    c.theme = a.theme;
    c.template = { profile: a.profile, fields: a.fields, blocks: a.blocks };
    await companiesRepo.replace(c);
    json(res, { ok: true, slug: '' });
  });

  // One new card: { name, slug?, title, department, bio, fields: { phone, email, … }, login }
  router.post('/api/companies/:id/members', async (req, res, { params }) => {
    const c = await companiesRepo.get(params.id);
    if (!c) return json(res, { error: 'nf' }, 404);
    const b = (await readJson(req, 1e5)) || {};
    const name = S(b.name, 80).trim();
    if (!name) return json(res, { error: 'name', message: 'Please enter the full name.' }, 400);
    if (b.slug && !validSlug(slugify(b.slug))) return json(res, { error: 'slug', message: 'That page address is not allowed. Use 2–40 letters, numbers or dashes.' }, 400);
    const r = await companies.addMember(c, { ...b, name }, { login: b.login !== false });
    json(res, { ...r.account, path: `${c.slug}/${r.account.slug}`, login: r.login }, 201);
  });

  // Excel / CSV import: { data: base64 of the file, login }
  router.post('/api/companies/:id/import', async (req, res, { params }) => {
    const c = await companiesRepo.get(params.id);
    if (!c) return json(res, { error: 'nf' }, 404);
    const b = await readJson(req, 12e6);
    if (!b || typeof b.data !== 'string') return json(res, { error: 'bad', message: 'No file received.' }, 400);
    const buf = Buffer.from(b.data.replace(/^data:[^,]*,/, ''), 'base64');
    if (!buf.length || buf.length > 8e6) return json(res, { error: 'size', message: 'The file is empty or larger than 8 MB.' }, 400);
    const r = await companies.importSheet(c, buf, { login: b.login !== false });
    if (r.error) return json(res, { error: 'file', message: r.error }, 400);
    json(res, r);
  });

  router.get('/api/companies/:id/template.xlsx', async (req, res, { params }) => {
    const c = await companiesRepo.get(params.id);
    if (!c) return json(res, { error: 'nf' }, 404);
    sendFile(res, companies.templateFile(c), `${c.slug}-people-template.xlsx`, XLSX);
  });

  router.get('/api/companies/:id/sign-ins.xlsx', async (req, res, { params }) => {
    const c = await companiesRepo.get(params.id);
    if (!c) return json(res, { error: 'nf' }, 404);
    sendFile(res, await companies.signInsFile(c, origin(req)), `${c.slug}-sign-ins.xlsx`, XLSX);
  });

  // Makes the company admin sign-in again (if it was deleted).
  router.post('/api/companies/:id/admin-login', async (req, res, { params }) => {
    const c = await companiesRepo.get(params.id);
    if (!c) return json(res, { error: 'nf' }, 404);
    if (adminLogin(await usersRepo.list(), c)) return json(res, { error: 'exists', message: 'This company already has a company admin sign-in.' }, 409);
    json(res, await owners.createCompanyAdmin(c), 201);
  });
}

module.exports = { forViewers, forAdmins };
