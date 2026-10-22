// The admin app's own identity and look (settings key "system"), set under Settings:
//   name     shown in the sidebar, the browser tab and the sign-in page   ("SBPO Link Tree")
//   logo     system logo ("/media/<id>" or '' = first letter of the name)
//   accent   main colour  (#rrggbb)        accent2  second colour of gradients
//   sidebar  'dark' | 'light'
const settings = require('../repositories/settings');
const media = require('./media');
const { img } = require('./sanitize');

const DEFAULTS = { name: 'SBPO Link Tree', logo: '', accent: '#4f46e5', accent2: '#06b6d4', sidebar: 'dark' };
const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);

let cached;
const normalise = (v = {}) => ({
  name: typeof v.name === 'string' && v.name.replace(/\s+/g, ' ').trim() ? v.name.replace(/\s+/g, ' ').trim().slice(0, 60) : DEFAULTS.name,
  logo: typeof v.logo === 'string' ? v.logo : '',
  accent: hex(v.accent, DEFAULTS.accent),
  accent2: hex(v.accent2, DEFAULTS.accent2),
  sidebar: v.sidebar === 'light' ? 'light' : 'dark',
});

async function get() {
  if (cached === undefined) cached = normalise((await settings.get('system', {})) || {});
  return cached;
}

// Updates only the fields that are given.
async function update(fields = {}) {
  const next = { ...(await get()) };
  for (const k of ['name', 'accent', 'accent2', 'sidebar']) if (fields[k] !== undefined) next[k] = fields[k];
  if (fields.logo !== undefined) next.logo = (await media.store(img(fields.logo))) || '';
  cached = normalise(next);
  await settings.set('system', cached);
  return cached;
}

module.exports = { get, update, DEFAULTS, reset: () => { cached = undefined; } };
