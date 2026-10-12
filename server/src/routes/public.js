// Public routes: profile pages, company pages, NFC taps, tracked link redirects, images.
//   /<slug>                 individual card, or a company page
//   /<company>/<slug>       a card of that company
//   /n/…                    the same pages, counted as an NFC tap
const accounts = require('../repositories/accounts');
const companies = require('../repositories/companies');
const pages = require('../services/pages');
const mediaRepo = require('../repositories/media');
const stats = require('../services/stats');
const brand = require('../services/brand');
const { renderPage } = require('../services/render');
const vcf = require('../services/vcard');
const { html, redirect, notFound, origin } = require('../lib/http');

const shouldTrack = req => req.method === 'GET' && !stats.BOT.test(req.headers['user-agent'] || '');
const dev = req => stats.device(req.headers['user-agent'] || '');


// The people listed on a company page.
async function teamOf(c) {
  if (c.showTeam === false) return null;
  return (await accounts.listByCompany(c.id)).map(m => ({
    name: m.profile.name, title: m.profile.title, photo: m.profile.photo, href: `/${c.slug}/${m.slug}?s=company`,
  }));
}

// /<slug>: an individual card or a company page. /<company>/<slug>: a card of that company.
async function showProfile(req, res, slug, src, memberSlug) {
  let doc, team = null;
  if (memberSlug) {
    const c = await companies.bySlug(slug);
    const a = c && (await accounts.bySlug(memberSlug, c.id));
    if (!a) return notFound(res);
    doc = pages.forDisplay(a, c);
  } else {
    const a = await accounts.bySlug(slug);
    if (a) doc = pages.forDisplay(a, null);
    else {
      const c = await companies.bySlug(slug);
      if (!c) return notFound(res);
      doc = pages.companyForDisplay(c);
      team = await teamOf(c);
    }
  }
  if (shouldTrack(req)) stats.track({ t: Date.now(), k: 'view', a: doc.id, src, dev: dev(req) });
  return html(res, renderPage(doc, { src, brand: await brand.get(), team }));
}

module.exports = router => {
  router.get('/media/:id', async (req, res, { params }) => {
    if (!/^[a-f0-9]{32}$/.test(params.id)) return notFound(res);
    const m = await mediaRepo.get(params.id);
    if (!m) return notFound(res);
    // Content-addressed, so the bytes behind a URL never change.
    res.writeHead(200, { 'Content-Type': m.type, 'Content-Length': m.data.length, 'Cache-Control': 'public, max-age=31536000, immutable' });
    res.end(m.data);
  });

  // Older links of the form /media/<accountId>/photo|logo
  router.get('/media/:account/:kind', async (req, res, { params }) => {
    const a = await accounts.get(params.account);
    const url = a && a.profile[params.kind === 'logo' ? 'logo' : 'photo'];
    return url ? redirect(res, url) : notFound(res);
  });

  router.get('/go/:account/:item', async (req, res, { params, url }) => {
    const pg = await pages.byId(params.account), a = pg && pg.doc;
    const it = a && a.blocks.flatMap(b => b.items || []).find(i => i.id === params.item);
    if (!it || !it.url) return redirect(res, pg ? '/' + pg.path : '/admin');
    if (shouldTrack(req)) stats.track({ t: Date.now(), k: 'click', a: a.id, id: it.id, title: it.title, src: stats.sourceOf(url), dev: dev(req) });
    return redirect(res, it.url);
  });

  const vcard = async (req, res, { params, url }) => {
    const pg = await pages.byId(params.account), a = pg && pg.doc;
    const c = a && a.blocks.find(b => b.type === 'contact' && (!params.block || b.id === params.block));
    if (!c || !(c.url || c.vcf || c.auto)) return redirect(res, pg ? '/' + pg.path : '/admin');
    if (shouldTrack(req)) stats.track({ t: Date.now(), k: 'click', a: a.id, id: c.id, title: c.label, src: stats.sourceOf(url), dev: dev(req) });
    // Serve the vCard ourselves with contact headers, so phones offer "add to contacts".
    const text = await vcf.load(c, a, `${origin(req)}/${pg.path}`);
    if (text) return vcf.send(res, text, a.profile.name);
    return c.url ? redirect(res, c.url) : redirect(res, '/' + pg.path); // the hosted file could not be read: old behaviour
  };
  router.get('/vcf/:account', vcard);
  router.get('/vcf/:account/:block', vcard);

  // NFC cards point at /n/<slug> so taps can be told apart from normal visits.
  router.get('/n/:slug', (req, res, { params }) => showProfile(req, res, params.slug, 'nfc'));
  router.get('/n/:company/:slug', (req, res, { params }) => showProfile(req, res, params.company, 'nfc', params.slug));
  router.get('/:slug', (req, res, { params, url }) => showProfile(req, res, params.slug, stats.sourceOf(url)));
  router.get('/:company/:slug', (req, res, { params, url }) => showProfile(req, res, params.company, stats.sourceOf(url), params.slug));
};
