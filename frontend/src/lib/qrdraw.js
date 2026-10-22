// Drawing QR codes: SVG markup for the screen and downloads, PNG through a canvas.
import { qrMatrix } from './qrcode.js';

// The address printed in every QR code. Scanning it records the scan, then opens the link / file / text.
export const qrUrl = code => `${location.origin}/q/${code}`;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// style: { fg, bg, shape: 'square'|'rounded'|'dots', logo: image URL (a data: URL for downloads) }
export function qrSvg(text, style = {}, { margin = 4, caption = '' } = {}) {
  const { fg = '#111111', bg = '#ffffff', shape = 'square', logo = '' } = style;
  const m = qrMatrix(text, logo ? 'H' : 'M');
  const n = m.size + margin * 2;
  const capH = caption ? Math.max(5, Math.round(n * 0.13)) : 0;

  // The middle is kept clear for the logo (error correction H restores the covered part).
  const box = logo ? Math.round(m.size * 0.24) | 1 : 0;
  const lo = (m.size - box) / 2;
  const underLogo = (x, y) => box && x >= lo - 0.5 && x < lo + box + 0.5 && y >= lo - 0.5 && y < lo + box + 0.5;

  let d = '', dots = '';
  for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) {
    if (!m.dark(x, y) || underLogo(x, y)) continue;
    if (shape !== 'square' && m.isFinder(x, y)) continue; // drawn as rounded eyes below
    const X = x + margin, Y = y + margin;
    if (shape === 'dots') dots += `<circle cx="${X + 0.5}" cy="${Y + 0.5}" r="0.46"/>`;
    else if (shape === 'rounded') dots += `<rect x="${X + 0.06}" y="${Y + 0.06}" width="0.88" height="0.88" rx="0.32"/>`;
    else d += `M${X} ${Y}h1v1h-1z`;
  }
  let eyes = '';
  if (shape !== 'square') {
    for (const [fx, fy] of [[0, 0], [m.size - 7, 0], [0, m.size - 7]]) {
      const X = fx + margin, Y = fy + margin;
      eyes += `<rect x="${X + 0.5}" y="${Y + 0.5}" width="6" height="6" rx="1.7" fill="none" stroke="${fg}" stroke-width="1"/>`
        + `<rect x="${X + 2}" y="${Y + 2}" width="3" height="3" rx="0.9" fill="${fg}"/>`;
    }
  }
  const logoEl = logo
    ? `<rect x="${lo + margin - 0.4}" y="${lo + margin - 0.4}" width="${box + 0.8}" height="${box + 0.8}" rx="${box * 0.18}" fill="${bg}"/>`
      + `<image href="${esc(logo)}" x="${lo + margin + 0.35}" y="${lo + margin + 0.35}" width="${box - 0.7}" height="${box - 0.7}" preserveAspectRatio="xMidYMid meet"/>`
    : '';
  const cap = caption
    ? `<text x="${n / 2}" y="${n + capH * 0.42}" text-anchor="middle" dominant-baseline="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-weight="600" font-size="${Math.max(2.4, n * 0.055)}" fill="${fg}">${esc(caption)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n + capH}" shape-rendering="${shape === 'square' ? 'crispEdges' : 'geometricPrecision'}">`
    + `<rect width="${n}" height="${n + capH}" fill="${bg}"/>`
    + (d ? `<path d="${d}" fill="${fg}"/>` : '') + (dots ? `<g fill="${fg}">${dots}</g>` : '') + eyes + logoEl + cap + '</svg>';
}

// Downloads must not depend on this site, so the logo is put inside the file.
export async function inlineImage(url) {
  if (!url || url.startsWith('data:')) return url;
  const blob = await (await fetch(url)).blob();
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
}

const save = (blob, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};
export const fileName = (name, ext) => `${String(name || 'qr-code').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-') || 'qr-code'}-qr.${ext}`;

export async function downloadSvg(text, style, name, caption) {
  const svg = qrSvg(text, { ...style, logo: await inlineImage(style.logo) }, { caption });
  save(new Blob([svg], { type: 'image/svg+xml' }), fileName(name, 'svg'));
}

export async function downloadPng(text, style, name, caption, px = 1200) {
  const svg = qrSvg(text, { ...style, logo: await inlineImage(style.logo) }, { caption });
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const [, , , w, h] = /viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg).map(Number);
  const c = document.createElement('canvas');
  c.width = px; c.height = Math.round(px * h / w);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  save(blob, fileName(name, 'png'));
}
