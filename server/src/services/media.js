// Image handling: turns data: URLs into stored media and keeps the media collection tidy.
const mediaRepo = require('../repositories/media');
const accountsRepo = require('../repositories/accounts');
const companiesRepo = require('../repositories/companies');
const settings = require('../repositories/settings');
const { DATA_URL } = require('./sanitize');

const MAX_BYTES = 1.2e6;

// Stores a data: URL and returns its "/media/<id>" URL. Anything else is returned unchanged.
async function store(value) {
  if (typeof value !== 'string' || !DATA_URL.test(value)) return value;
  const m = /^data:(image\/\w+);base64,(.*)$/.exec(value);
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_BYTES) return '';
  return '/media/' + (await mediaRepo.put(buf, m[1]));
}

// Every image slot in an account, as [object, key] pairs.
function slots(account) {
  const out = [[account.profile, 'photo'], [account.profile, 'logo'], [account.theme, 'bgImage']];
  for (const b of account.blocks || []) {
    for (const it of b.items || []) out.push([it, 'img']);
    if (b.type === 'contact') out.push([b, 'vcf']); // uploaded vCard file
    if (b.imgs) b.imgs.forEach((_, i) => out.push([b.imgs, i]));
  }
  return out;
}

async function ingestAccount(account) {
  for (const [obj, k] of slots(account)) if (obj && obj[k]) obj[k] = await store(obj[k]);
  return account;
}

const idOf = url => (typeof url === 'string' && url.startsWith('/media/') ? url.slice(7) : null);

// Deletes images no account (or the brand logo) points at any more.
// A grace period keeps fresh uploads that have not been saved into an account yet.
async function collectGarbage(graceMs = 24 * 3600e3) {
  const keep = new Set();
  const docs = await accountsRepo.list();
  for (const c of await companiesRepo.list()) docs.push({ ...c.page, theme: c.theme }, { ...c.template, theme: c.theme });
  for (const a of docs) for (const [obj, k] of slots(a)) { const id = idOf(obj && obj[k]); if (id) keep.add(id); }
  const brand = await settings.get('brand', {});
  const b = idOf(brand && brand.logo);
  if (b) keep.add(b);
  return mediaRepo.removeUnreferenced(keep, Date.now() - graceMs);
}

module.exports = { store, ingestAccount, collectGarbage, MAX_BYTES };
