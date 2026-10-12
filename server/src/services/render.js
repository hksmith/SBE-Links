// Server-side rendering of the public link-in-bio page for one account.
const ICONS = require('../data/icons');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SERIF = ['Playfair Display', 'Lora', 'Libre Baskerville', 'Linden Hill', 'Merriweather'];
const ONEW = ['Linden Hill', 'Bebas Neue', 'Pacifico'];
const fam = f => `'${f}',${SERIF.includes(f) ? 'Georgia,serif' : f === 'Space Mono' ? 'monospace' : 'system-ui,sans-serif'}`;
const svg = (k, sz = 22) => (ICONS[k] ? `<svg viewBox="${ICONS[k][1]}" width="${sz}" height="${sz}" fill="currentColor" aria-hidden="true">${ICONS[k][2]}</svg>` : '');
const iconOf = (i, sz = 22) => (i.img ? `<img alt="" src="${esc(i.img)}">` : i.ico && ICONS[i.ico] ? svg(i.ico, sz) : esc(i.icon));

// Company logo sits in the top-right corner. logoSize = % of the page width, capped so it stays a corner logo.
const LOGO_MAX_PCT = 45;

function renderPage(a, { src = 'direct', preview = false, brand = {} } = {}) {
  const brandLogo = brand.logo || '', brandText = brand.text ?? 'Powered by Shaggar BPO Enterprise', brandSize = brand.logoSize || 18;
  const t = a.theme, p = a.profile, T = preview ? ' target="_blank" rel="noopener"' : '', L = t.align === 'left';
  const go = id => `/go/${a.id}/${id}?s=${src}`;
  const LG = { s: Math.min(p.logoSize ?? 30, LOGO_MAX_PCT), h: p.logoH ?? 40, z: p.logoZoom ?? 100, x: p.logoX ?? 0, y: p.logoY ?? 0 };
  const X = t.tx || {}, tf = k => (X[k] && X[k].f ? `font-family:${fam(X[k].f)};` : ''), ts = k => (X[k] && X[k].s ? `font-size:${X[k].s}px;` : '');
  const TXCSS = `h1{${tf('name')}${ts('name')}}.ti{${tf('title')}${ts('title')}}.dp{${tf('dept')}${ts('dept')}}.co{${tf('company')}${ts('company')}}.bio{${tf('bio')}${ts('bio')}}.lk{${tf('link')}}.lk .l{${ts('link')}}.lk .l small{${tf('sub')}${ts('sub')}}.bx{${tf('block')}${ts('block')}}.pw{${tf('foot')}${ts('foot')}}`;
  const gf = [...new Set([t.disp, t.body, ...Object.values(X).map(v => v && v.f).filter(Boolean), ...a.blocks.map(b => b.f).filter(Boolean)])]
    .map(f => 'family=' + f.replace(/ /g, '+') + (ONEW.includes(f) ? '' : ':wght@400;700')).join('&');
  const bg = t.bgType === 'gradient' ? `linear-gradient(160deg,${t.pageBg},${t.bg2})` : t.bgType === 'image' && t.bgImage ? `${t.pageBg} url("${t.bgImage}") center/cover fixed no-repeat` : t.pageBg;
  const fade = t.bgType === 'gradient' ? t.bg2 : t.pageBg, hs = { small: 22, medium: 30, large: 42 }[t.headSize];
  const ring = t.picOutline ? `box-shadow:0 0 0 4px ${t.headText};` : '', circ = t.picShape === 'circle';
  const lkbg = `color-mix(in srgb,${t.linkBg} ${100 - t.alpha}%,transparent)`, bd = `2px solid ${t.outline ? t.linkShadow : 'transparent'}`, sh = t.shadow ? '0 8px 22px rgba(0,0,0,.28)' : 'none';
  // With a full-width photo (banner / portrait) the logo floats over the photo; otherwise it gets its own row so nothing overlaps.
  const overlay = !!p.photo && (t.layout === 'banner' || t.layout === 'portrait');

  let h = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.name)}</title><meta property="og:title" content="${esc(p.name)}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${gf}&display=swap">
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:${bg};color:${t.headText};font-family:${fam(t.body)};text-align:center;padding:0 0 40px}
.pg{position:relative;max-width:480px;margin:0 auto}
.w{max-width:480px;margin:0 auto;padding:0 18px}.pp{display:block;margin:36px auto 14px;width:min(${t.picSize}px,78%);aspect-ratio:1;object-fit:cover;object-position:top;border-radius:${circ ? '50%' : '22px'};${ring}}
.lgbar+.pp{margin-top:10px}
.bn{display:block;width:100%;max-width:480px;height:${Math.round(t.picSize * 1.4)}px;object-fit:cover;object-position:top;margin:0 auto 14px;border-radius:0 0 ${circ ? 60 : 24}px ${circ ? 60 : 24}px;${ring}}
.pt{position:relative;max-width:480px;margin:0 auto}.pt img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;object-position:top}.pt:after{content:"";position:absolute;left:0;right:0;bottom:0;height:50%;background:linear-gradient(transparent,${fade})}.pt+.w h1{margin-top:-72px;position:relative;z-index:1}
h1{font-family:${fam(t.disp)};font-size:${hs}px;margin:10px 0 4px;line-height:1.15}.hd{margin:0 0 14px}.ti{opacity:.85;margin:0 0 4px}.dp{opacity:.8;margin:0 0 4px}.co{font-weight:700;font-size:18px;margin:8px 0 0}
.lgbar{display:flex;justify-content:flex-end;padding:14px 14px 0}.lgo{position:absolute;top:14px;right:14px;z-index:3}
.lgc{display:inline-block;padding:6px 8px;border-radius:12px;background:rgba(255,255,255,.94);box-shadow:0 4px 16px rgba(0,0,0,.14);line-height:0}
.lgw{width:min(${(LG.s * 4.8).toFixed(1)}px,${LG.s}vw);aspect-ratio:100/${LG.h};overflow:hidden}.lgw img{display:block;width:100%;height:100%;object-fit:contain;transform:translate(${LG.x}%,${LG.y}%) scale(${LG.z / 100})}
.pw{margin-top:30px;font-size:12px;opacity:.75;letter-spacing:.03em;display:flex;align-items:center;justify-content:center;gap:8px}.pw img{width:auto;object-fit:contain}.bio{margin:0 0 18px;opacity:.85;white-space:pre-line}
.lk{display:flex;align-items:center;gap:10px;padding:16px 18px;margin:0 0 12px;border-radius:${t.radius}px;background:${lkbg};color:${t.linkText};text-decoration:none;font-weight:700;font-size:17px;border:${bd};box-shadow:${sh};${t.alpha > 0 ? 'backdrop-filter:blur(8px);' : ''}transition:transform .15s}
.lk:active,.lk:hover{transform:translateY(-2px)}.lk .i{width:26px;height:26px;font-size:22px;display:flex;align-items:center;justify-content:center;flex:none}.lk .i img{width:26px;height:26px;border-radius:6px;object-fit:cover}.lk .l small{display:block;font-weight:400;font-size:13px;opacity:.8;margin-top:2px}.lk .l{flex:1;text-align:${t.align};${L ? '' : 'margin-right:26px'}}
.bx{background:${t.blockBg};color:${t.blockText};border-radius:${t.radius}px;padding:16px;margin:0 0 12px;white-space:pre-line;text-align:left}
.gal{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:0 0 12px}.gal img{width:100%;border-radius:${t.radius}px;display:block}
.vd{position:relative;padding-top:56.25%;margin:0 0 12px;border-radius:${t.radius}px;overflow:hidden}.vd iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.soc{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:0 0 12px}.s.ic{width:46px;height:46px;padding:0;display:inline-flex;align-items:center;justify-content:center}.s img{width:24px;height:24px;border-radius:50%;object-fit:cover}.s{padding:9px 16px;border-radius:99px;background:${lkbg};color:${t.linkText};text-decoration:none;font-size:14px;font-weight:700;border:${bd}}
hr{border:0;border-top:1px solid currentColor;opacity:.25;margin:16px 0}${TXCSS}</style></head><body><div class="pg">`;

  const logo = p.logo ? `<div class="lgc"><div class="lgw"><img alt="${esc(p.company || 'Company logo')}" src="${esc(p.logo)}"></div></div>` : '';
  if (logo) h += overlay ? `<div class="lgo">${logo}</div>` : `<div class="lgbar">${logo}</div>`;
  if (p.photo) h += t.layout === 'banner' ? `<img class="bn" alt="" src="${esc(p.photo)}">` : t.layout === 'portrait' ? `<div class="pt"><img alt="" src="${esc(p.photo)}"></div>` : `<img class="pp" alt="" src="${esc(p.photo)}">`;
  h += `<div class="w"${p.photo ? '' : ` style="padding-top:${logo ? 16 : 48}px"`}><h1>${esc(p.name)}</h1><div class="hd">${p.title ? `<div class="ti">${esc(p.title)}</div>` : ''}${p.department ? `<div class="dp">${esc(p.department)}</div>` : ''}${p.company ? `<div class="co">${esc(p.company)}</div>` : ''}</div>${p.bio ? `<div class="bio">${esc(p.bio)}</div>` : ''}`;

  for (const b of a.blocks) {
    if (b.off) continue;
    if (b.type === 'links') { for (const i of b.items) if (!i.off) h += `<a class="lk" href="${go(i.id)}"${T}><span class="i">${iconOf(i)}</span><span class="l">${esc(i.title)}${i.sub ? `<small>${esc(i.sub)}</small>` : ''}</span></a>`; }
    else if (b.type === 'social') h += `<div class="soc">${b.items.filter(i => !i.off).map(i => { const ic = iconOf(i, 24); return `<a class="s${ic ? ' ic' : ''}" href="${go(i.id)}" aria-label="${esc(i.title)}"${T}>${ic || esc(i.title)}</a>`; }).join('')}</div>`;
    else if (b.type === 'contact') { if (b.url || b.vcf) h += `<a class="lk" data-vcf href="/vcf/${a.id}/${b.id}?s=${src}"${T}><span class="i">${svg('contact')}</span><span class="l">${esc(b.label)}</span></a>`; }
    else if (b.type === 'text') h += `<div class="bx"${b.f || b.s ? ` style="${b.f ? `font-family:${fam(b.f)};` : ''}${b.s ? `font-size:${b.s}px;` : ''}"` : ''}>${esc(b.text)}</div>`;
    else if (b.type === 'images') h += `<div class="gal">${b.imgs.map(s => `<img alt="" src="${esc(s)}">`).join('')}</div>`;
    else if (b.type === 'video') { const m = /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(b.url || ''); if (m) h += `<div class="vd"><iframe src="https://www.youtube.com/embed/${m[1]}" loading="lazy" allowfullscreen></iframe></div>`; }
    else if (b.type === 'divider') h += '<hr>';
  }
  const hasVcf = a.blocks.some(b => b.type === 'contact' && !b.off && (b.url || b.vcf));
  return h + (brandText || brandLogo ? `<div class="pw">${brandText ? `<span>${esc(brandText)}</span>` : ''}${brandLogo ? `<img alt="" src="${esc(brandLogo)}" style="height:${brandSize}px;max-width:${brandSize * 5}px">` : ''}</div>` : '') + `</div></div>${hasVcf ? ANDROID_HINT : ''}</body></html>`;
}

// Chrome on Android never opens a vCard straight into Contacts: it always downloads it first.
// Because we serve it as text/x-vcard, the download's "Open" button goes straight to "add contact",
// so Android visitors get a short pointer to that button.
const ANDROID_HINT = `<div id="vh" hidden style="position:fixed;inset:auto 0 0 0;z-index:9;padding:12px;font:15px/1.45 system-ui,sans-serif;text-align:left">
<div style="max-width:440px;margin:0 auto 64px;background:#fff;color:#111;border-radius:16px;padding:16px 18px;box-shadow:0 12px 40px rgba(0,0,0,.35)">
<b style="display:block;font-size:16px;margin-bottom:4px">Saving the contact…</b>When the download finishes, tap <b>Open</b> at the bottom of the screen, then <b>Save</b> / <b>Import</b>.
<div style="font-size:13px;color:#555;margin-top:6px">Missed it? Open <b>Downloads</b> and tap the <b>.vcf</b> file.</div>
<button type="button" style="margin-top:12px;width:100%;padding:10px;border:0;border-radius:10px;background:#111;color:#fff;font:600 15px system-ui,sans-serif">OK</button></div></div>
<script>(function(){if(!/Android/i.test(navigator.userAgent))return;var h=document.getElementById('vh');h.querySelector('button').onclick=function(){h.hidden=true};
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-vcf]');if(a)setTimeout(function(){h.hidden=false},300)})})()</script>`;

module.exports = { renderPage, esc };
