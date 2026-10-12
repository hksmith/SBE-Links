// Company-wide branding, shown in the admin header and the footer of every page (public pages and the admin):
//   logo      brand logo ("/media/<id>" or '')
//   logoSize  footer logo height in px (12–60)
//   text      footer statement, e.g. "Powered by Shaggar BPO Enterprise" ('' hides it)
const settings = require('../repositories/settings');
const media = require('./media');
const { img } = require('./sanitize');

const DEFAULT_TEXT = 'Powered by Shaggar BPO Enterprise';
const DEFAULT_SIZE = 18;
const MIN_SIZE = 12, MAX_SIZE = 60;

let cached; // undefined = not loaded yet

const normalise = (v = {}) => ({
  logo: typeof v.logo === 'string' ? v.logo : '',
  logoSize: Number.isFinite(+v.logoSize) && v.logoSize !== '' && v.logoSize != null
    ? Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(+v.logoSize))) : DEFAULT_SIZE,
  text: typeof v.text === 'string' ? v.text.replace(/\s+/g, ' ').trim().slice(0, 120) : DEFAULT_TEXT,
});

async function get() {
  if (cached === undefined) cached = normalise((await settings.get('brand', {})) || {});
  return cached;
}

const logo = async () => (await get()).logo;

// Updates only the fields that are given: { logo?, logoSize?, text? }
async function update(fields = {}) {
  const next = { ...(await get()) };
  if (fields.logo !== undefined) next.logo = (await media.store(img(fields.logo))) || '';
  if (fields.logoSize !== undefined) next.logoSize = fields.logoSize;
  if (fields.text !== undefined) next.text = String(fields.text ?? '');
  cached = normalise(next);
  await settings.set('brand', cached);
  return cached;
}

const setLogo = async value => (await update({ logo: value })).logo;

module.exports = { get, logo, update, setLogo, DEFAULT_TEXT, DEFAULT_SIZE, MIN_SIZE, MAX_SIZE, reset: () => { cached = undefined; } };
