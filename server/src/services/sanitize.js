// Validation / normalisation of account documents coming from the admin UI.
const crypto = require('crypto');
const ICONS = require('../data/icons');

// Addresses used by the app itself (and by the admin app's files when it is hosted on Vercel).
const RESERVED = ['admin', 'api', 'go', 'n', 'vcf', 'login', 'logout', 'media', 'q', 'favicon.ico', 'assets', 'brand.json', 'index.html', 'login.html'];
// A person's details. Links can use them as {phone}, {email}, …; any other Excel column works the same way.
const FIELDS = ['phone', 'email', 'whatsapp', 'website', 'linkedin', 'address'];
const FONTS = ['Inter', 'Sora', 'Poppins', 'DM Sans', 'Montserrat', 'Outfit', 'Manrope', 'Plus Jakarta Sans', 'Urbanist', 'Raleway', 'Nunito', 'Roboto', 'Open Sans', 'Lato', 'Work Sans', 'Rubik', 'Oswald',
  'Playfair Display', 'Lora', 'Libre Baskerville', 'Cormorant Garamond', 'Linden Hill', 'Merriweather', 'Space Grotesk', 'Space Mono', 'Orbitron', 'Bebas Neue', 'Pacifico', 'Dancing Script', 'Great Vibes',
  'Noto Sans Ethiopic', 'Noto Serif Ethiopic', 'Abyssinica SIL'];
// Design choices with a fixed list of values.
const LOGO_POS = ['tl', 'tc', 'tr', 'under', 'bl', 'bc', 'br'];
const BG_POS = ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'];
const COLOR_KEYS = ['pageBg', 'headText', 'linkBg', 'linkText', 'linkShadow', 'blockBg', 'blockText'];
const TXK = ['name', 'title', 'dept', 'company', 'bio', 'link', 'sub', 'block', 'foot'];
const NEUTRAL = { pageBg: '#ffffff', headText: '#111111', linkBg: '#111111', linkText: '#ffffff', linkShadow: '#111111', blockBg: '#f3f3f3', blockText: '#111111', radius: 12, bgType: 'solid', bg2: '#302b63', bgImage: '', layout: 'minimal', picShape: 'rounded', picSize: 250, picOutline: false, disp: 'Inter', body: 'Inter', headSize: 'medium', alpha: 0, shadow: false, outline: true, align: 'center', tx: {},
  bgSize: 'cover', bgZoom: 100, bgPos: 'center', bgFixed: true, bgDim: 0, bgAngle: 160, picRing: '', picRingW: 4, headAlign: 'center', gap: 12, btnSize: 'm', iconPos: 'left', mode: {}, cust: {} };

const MEDIA_URL = /^\/media\/[a-f0-9]{32}$/;
const DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

const rid = () => crypto.randomBytes(4).toString('hex');
const S = (v, n) => String(v ?? '').slice(0, n);
const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v : d);
const font = v => (FONTS.includes(v) ? v : 'Inter');
const clamp = (v, a, b, d) => Math.max(a, Math.min(b, Number.isFinite(+v) ? +v : d));
const pickOf = (v, list, d) => (list.includes(v) ? v : d);
const okId = v => /^[\w-]{1,20}$/.test(v);

// Images are stored in the media collection and referenced as "/media/<id>".
// A raw data: URL is still accepted here; the media service converts it before saving.
const img = v => (typeof v === 'string' && (MEDIA_URL.test(v) || (v.length < 1.6e6 && DATA_URL.test(v))) ? v : '');

const safeUrl = u => {
  u = String(u || '').trim().slice(0, 500);
  if (!u) return '';
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? '' : 'https://' + u;
};

const slugify = s => S(s, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const validSlug = s => typeof s === 'string' && /^[a-z0-9-]{2,40}$/.test(s) && !RESERVED.includes(s);

const txClean = x => {
  const o = {};
  for (const k of TXK) {
    const v = (x && x[k]) || {};
    o[k] = { f: FONTS.includes(v.f) ? v.f : '', s: +v.s ? clamp(v.s, 8, 72, 0) : 0 };
  }
  return o;
};

// What the person picked last in each "Custom" tab (colors, fonts, block style), so going back to Custom restores it.
const modeClean = m => {
  const o = {};
  for (const k of ['colors', 'fonts', 'block']) if (m && typeof m[k] === 'string' && m[k]) o[k] = S(m[k], 20);
  return o;
};
function custClean(c) {
  const o = {};
  if (!c || typeof c !== 'object') return o;
  if (c.colors && typeof c.colors === 'object') { o.colors = {}; for (const k of COLOR_KEYS) if (/^#[0-9a-f]{6}$/i.test(c.colors[k])) o.colors[k] = c.colors[k]; }
  if (c.fonts && typeof c.fonts === 'object') o.fonts = { disp: font(c.fonts.disp), body: font(c.fonts.body) };
  if (c.block && typeof c.block === 'object') o.block = { radius: clamp(c.block.radius, 0, 40, 12), alpha: clamp(c.block.alpha, 0, 100, 0), shadow: !!c.block.shadow, outline: c.block.outline === undefined ? true : !!c.block.outline };
  return o;
}

function newAccount(name, slug) {
  return {
    id: rid(), slug, created: Date.now(),
    profile: { name, title: '', department: '', company: '', bio: '', photo: '', logo: '', logoSize: 30, logoH: 40, logoZoom: 100, logoX: 0, logoY: 0, logoPos: 'tr', logoBg: true },
    theme: { ...NEUTRAL },
    blocks: [{ id: rid(), type: 'contact', label: 'Save My Contact', url: '' }, { id: rid(), type: 'links', items: [] }],
  };
}

// Returns a clean copy of `b` that keeps identity fields from `old`.
// `out.slug` is only the *requested* slug; the caller checks it is free.
function clean(b, old) {
  const p = b.profile || {}, t = b.theme || {};
  const out = {
    id: old.id, slug: old.slug, created: old.created,
    profile: {
      name: S(p.name, 80), title: S(p.title, 80), department: S(p.department, 80), company: S(p.company, 80), bio: S(p.bio, 400),
      photo: img(p.photo), logo: img(p.logo),
      logoSize: clamp(p.logoSize, 10, 90, 30), logoH: clamp(p.logoH, 15, 150, 40), logoZoom: clamp(p.logoZoom, 50, 300, 100),
      logoX: clamp(p.logoX, -50, 50, 0), logoY: clamp(p.logoY, -50, 50, 0),
      logoPos: pickOf(p.logoPos, LOGO_POS, 'tr'), logoBg: p.logoBg === undefined ? true : !!p.logoBg,
    },
    theme: {
      pageBg: hex(t.pageBg, '#ffffff'), headText: hex(t.headText, '#111111'), linkBg: hex(t.linkBg, '#111111'), linkText: hex(t.linkText, '#ffffff'), linkShadow: hex(t.linkShadow, '#111111'),
      blockBg: hex(t.blockBg, '#f3f3f3'), blockText: hex(t.blockText, '#111111'), radius: clamp(t.radius, 0, 40, 12),
      bgType: ['solid', 'gradient', 'image'].includes(t.bgType) ? t.bgType : 'solid', bg2: hex(t.bg2, '#302b63'), bgImage: img(t.bgImage),
      layout: ['minimal', 'banner', 'portrait'].includes(t.layout) ? t.layout : 'minimal', picShape: pickOf(t.picShape, ['rounded', 'circle', 'square'], 'rounded'),
      picSize: clamp(t.picSize, 60, 420, 250), picOutline: !!t.picOutline,
      disp: font(t.disp), body: font(t.body), headSize: ['small', 'medium', 'large'].includes(t.headSize) ? t.headSize : 'medium',
      alpha: clamp(t.alpha, 0, 100, 0), shadow: !!t.shadow, outline: t.outline === undefined ? true : !!t.outline, align: t.align === 'left' ? 'left' : 'center',
      tx: txClean(t.tx),
      bgSize: pickOf(t.bgSize, ['cover', 'contain', 'zoom'], 'cover'), bgZoom: clamp(t.bgZoom, 20, 300, 100), bgPos: pickOf(t.bgPos, BG_POS, 'center'),
      bgFixed: t.bgFixed === undefined ? true : !!t.bgFixed, bgDim: clamp(t.bgDim, 0, 80, 0), bgAngle: clamp(t.bgAngle, 0, 360, 160),
      picRing: /^#[0-9a-f]{6}$/i.test(t.picRing) ? t.picRing : '', picRingW: clamp(t.picRingW, 1, 12, 4),
      headAlign: t.headAlign === 'left' ? 'left' : 'center', gap: clamp(t.gap, 4, 30, 12), btnSize: pickOf(t.btnSize, ['s', 'm', 'l'], 'm'),
      iconPos: t.iconPos === 'right' ? 'right' : 'left',
      mode: modeClean(t.mode), cust: custClean(t.cust),
    },
  };
  if (validSlug(b.slug)) out.slug = b.slug;
  const items = a => (a || []).slice(0, 50).map(i => ({
    id: okId(i.id) ? i.id : rid(), ico: ICONS[i.ico] ? i.ico : '', icon: S(i.icon, 8), img: img(i.img),
    title: S(i.title, 100), sub: S(i.sub, 120), url: safeUrl(i.url), off: !!i.off,
  }));
  out.blocks = (b.blocks || []).slice(0, 60).map(x => {
    const o = { id: okId(x.id) ? x.id : rid(), type: x.type, off: !!x.off };
    if (x.type === 'links' || x.type === 'social') o.items = items(x.items);
    else if (x.type === 'images') o.imgs = (x.imgs || []).slice(0, 12).map(img).filter(Boolean);
    else if (x.type === 'text') Object.assign(o, { text: S(x.text, 2000), f: FONTS.includes(x.f) ? x.f : '', s: +x.s ? clamp(x.s, 8, 72, 0) : 0 });
    else if (x.type === 'video') o.url = safeUrl(x.url);
    else if (x.type === 'contact') Object.assign(o, { label: S(x.label, 60) || 'Save My Contact', url: safeUrl(x.url), vcf: MEDIA_URL.test(x.vcf) ? x.vcf : '', vcfName: x.vcf ? S(x.vcfName, 80) : '', auto: !!x.auto });
    else if (x.type !== 'divider') return null;
    return o;
  }).filter(Boolean);
  out.fields = cleanFields(b.fields);
  return out;
}

// { phone: '+251…', email: '…', … }: keys are lowercase letters, digits or _, at most 30 of them.
const fieldKey = k => String(k ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
function cleanFields(f) {
  const out = {};
  if (!f || typeof f !== 'object') return out;
  for (const [k, v] of Object.entries(f).slice(0, 40)) {
    const key = fieldKey(k), val = S(v, 300).trim();
    if (key && val && Object.keys(out).length < 30) out[key] = val;
  }
  return out;
}

module.exports = { RESERVED, FONTS, LOGO_POS, BG_POS, NEUTRAL, FIELDS, ICONS, rid, S, img, safeUrl, slugify, validSlug, newAccount, clean, cleanFields, fieldKey, DATA_URL, MEDIA_URL };
