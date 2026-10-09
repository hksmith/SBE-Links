// Company-wide brand logo (shown in the admin header and the "Powered by" footer of every page).
const settings = require('../repositories/settings');
const media = require('./media');
const { img } = require('./sanitize');

let cached; // undefined = not loaded yet

async function logo() {
  if (cached === undefined) cached = ((await settings.get('brand', {})) || {}).logo || '';
  return cached;
}

async function setLogo(value) {
  const url = await media.store(img(value));
  await settings.set('brand', { logo: url || '' });
  cached = url || '';
  return cached;
}

module.exports = { logo, setLogo, reset: () => { cached = undefined; } };
