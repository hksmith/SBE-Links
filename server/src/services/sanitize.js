// Validation / normalisation of account documents coming from the admin UI.
const crypto = require('crypto');
const ICONS = require('../data/icons');

const RESERVED = ['admin', 'api', 'go', 'n', 'vcf', 'login', 'logout', 'media', 'health', 'favicon.ico'];
const FONTS = ['Inter', 'Poppins', 'DM Sans', 'Montserrat', 'Playfair Display', 'Lora', 'Libre Baskerville', 'Linden Hill', 'Merriweather', 'Space Grotesk', 'Space Mono', 'Orbitron', 'Bebas Neue', 'Pacifico'];
const TXK = ['name', 'title', 'dept', 'company', 'bio', 'link', 'sub', 'block', 'foot'];
const NEUTRAL = { pageBg: '#ffffff', headText: '#111111', linkBg: '#111111', linkText: '#ffffff', linkShadow: '#111111', blockBg: '#f3f3f3', blockText: '#111111', radius: 12, bgType: 'solid', bg2: '#302b63', bgImage: '', layout: 'minimal', picShape: 'rounded', picSize: 250, picOutline: false, disp: 'Inter', body: 'Inter', headSize: 'medium', alpha: 0, shadow: false, outline: true, align: 'center', tx: {} };

const MEDIA_URL = /^\/media\/[a-f0-9]{32}$/;
const DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

const rid = () => crypto.randomBytes(4).toString('hex');
const S = (v, n) => String(v ?? '').slice(0, n);
const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v : d);
const font = v => (FONTS.includes(v) ? v : 'Inter');
const clamp = (v, a, b, d) => Math.max(a, Math.min(b, Number.isFinite(+v) ? +v : d));
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

function newAccount(name, slug) {
  return {
    id: rid(), slug, created: Date.now(),
    profile: { name, title: '', department: '', company: '', bio: '', photo: '', logo: '', logoSize: 30, logoH: 40, logoZoom: 100, logoX: 0, logoY: 0 },
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
      logoSize: clamp(p.logoSize, 10, 100, 30), logoH: clamp(p.logoH, 15, 150, 40), logoZoom: clamp(p.logoZoom, 50, 300, 100),
      logoX: clamp(p.logoX, -50, 50, 0), logoY: clamp(p.logoY, -50, 50, 0),
    },
    theme: {
      pageBg: hex(t.pageBg, '#ffffff'), headText: hex(t.headText, '#111111'), linkBg: hex(t.linkBg, '#111111'), linkText: hex(t.linkText, '#ffffff'), linkShadow: hex(t.linkShadow, '#111111'),
      blockBg: hex(t.blockBg, '#f3f3f3'), blockText: hex(t.blockText, '#111111'), radius: clamp(t.radius, 0, 40, 12),
      bgType: ['solid', 'gradient', 'image'].includes(t.bgType) ? t.bgType : 'solid', bg2: hex(t.bg2, '#302b63'), bgImage: img(t.bgImage),
      layout: ['minimal', 'banner', 'portrait'].includes(t.layout) ? t.layout : 'minimal', picShape: t.picShape === 'circle' ? 'circle' : 'rounded',
      picSize: clamp(t.picSize, 60, 420, 250), picOutline: !!t.picOutline,
      disp: font(t.disp), body: font(t.body), headSize: ['small', 'medium', 'large'].includes(t.headSize) ? t.headSize : 'medium',
      alpha: clamp(t.alpha, 0, 100, 0), shadow: !!t.shadow, outline: t.outline === undefined ? true : !!t.outline, align: t.align === 'left' ? 'left' : 'center',
      tx: txClean(t.tx),
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
    else if (x.type === 'contact') Object.assign(o, { label: S(x.label, 60) || 'Save My Contact', url: safeUrl(x.url) });
    else if (x.type !== 'divider') return null;
    return o;
  }).filter(Boolean);
  return out;
}

module.exports = { RESERVED, FONTS, NEUTRAL, ICONS, rid, S, img, safeUrl, slugify, validSlug, newAccount, clean, DATA_URL, MEDIA_URL };
