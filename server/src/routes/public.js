// Public routes: profile pages, NFC taps, tracked link redirects, images.
const accounts = require('../repositories/accounts');
const mediaRepo = require('../repositories/media');
const stats = require('../services/stats');
const brand = require('../services/brand');
const { renderPage } = require('../services/render');
const { html, redirect, notFound } = require('../lib/http');

const shouldTrack = req => req.method === 'GET' && !stats.BOT.test(req.headers['user-agent'] || '');
const dev = req => stats.device(req.headers['user-agent'] || '');

async function showProfile(req, res, slug, src) {
  const a = await accounts.bySlug(slug);
  if (!a) return notFound(res);
  if (shouldTrack(req)) stats.track({ t: Date.now(), k: 'view', a: a.id, src, dev: dev(req) });
  return html(res, renderPage(a, { src, brandLogo: await brand.logo() }));
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
    const a = await accounts.get(params.account);
    const it = a && a.blocks.flatMap(b => b.items || []).find(i => i.id === params.item);
    if (!it || !it.url) return redirect(res, a ? '/' + a.slug : '/');
    if (shouldTrack(req)) stats.track({ t: Date.now(), k: 'click', a: a.id, id: it.id, title: it.title, src: stats.sourceOf(url), dev: dev(req) });
    return redirect(res, it.url);
  });

  const vcard = async (req, res, { params, url }) => {
    const a = await accounts.get(params.account);
    const c = a && a.blocks.find(b => b.type === 'contact' && (!params.block || b.id === params.block));
    if (!c || !c.url) return redirect(res, a ? '/' + a.slug : '/');
    if (shouldTrack(req)) stats.track({ t: Date.now(), k: 'click', a: a.id, id: c.id, title: c.label, src: stats.sourceOf(url), dev: dev(req) });
    return redirect(res, c.url);
  };
  router.get('/vcf/:account', vcard);
  router.get('/vcf/:account/:block', vcard);

  // NFC cards point at /n/<slug> so taps can be told apart from normal visits.
  router.get('/n/:slug', (req, res, { params }) => showProfile(req, res, params.slug, 'nfc'));
  router.get('/:slug', (req, res, { params, url }) => showProfile(req, res, params.slug, stats.sourceOf(url)));
};
