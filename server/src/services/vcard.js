// "Save contact" vCards.
// Phones only offer "add to contacts" when the file arrives with a vCard content type and a .vcf name.
// Links hosted elsewhere (Google Drive, Dropbox, websites) often send it as a generic download or an
// HTML page, so on Android it just lands in Downloads. This service therefore always serves the
// vCard from our own server with the right headers:
//   - an uploaded .vcf (stored in the media collection), or
//   - the pasted link, fetched by the server and passed on with the right headers, or
//   - built automatically from the person's details (block.auto): name, job title, company, phone, email, …
const mediaRepo = require('../repositories/media');

const MAX = 1e6;
const VCARD = /^﻿?\s*BEGIN:VCARD[\s\S]*END:VCARD\s*$/i;
const cache = new Map(); // url -> { t, text }
const CACHE_MS = 10 * 60e3;

const isVcard = t => typeof t === 'string' && t.length <= MAX && VCARD.test(t);

async function storeUpload(text) {
  if (typeof text !== 'string' || !text.trim()) return { error: 'bad', message: 'The file is empty.' };
  if (text.length > MAX) return { error: 'size', message: 'The vCard file is too large (max 1 MB).' };
  if (!isVcard(text)) return { error: 'bad', message: 'That does not look like a vCard (.vcf) file.' };
  const id = await mediaRepo.put(Buffer.from(text.replace(/^﻿/, ''), 'utf8'), 'text/vcard');
  return { url: '/media/' + id };
}

// Share links of common file hosts point at a web page; turn them into direct downloads.
function directUrl(u) {
  let m = /^https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{10,})/.exec(u);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  if (/^https:\/\/(www\.)?dropbox\.com\//.test(u)) return u.replace(/([?&])dl=0\b/, '$1dl=1') + (/[?&]dl=/.test(u) ? '' : (u.includes('?') ? '&' : '?') + 'dl=1');
  if (/^https:\/\/1drv\.ms\//.test(u) || /^https:\/\/onedrive\.live\.com\//.test(u)) return u + (u.includes('?') ? '&' : '?') + 'download=1';
  return u;
}

async function fetchRemote(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.text;
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const r = await fetch(directUrl(url), { redirect: 'follow', signal: AbortSignal.timeout(6000), headers: { Accept: 'text/vcard,text/x-vcard,text/directory,*/*;q=0.5', 'User-Agent': 'SBPO-LinkTree/2 (vCard)' } });
    if (!r.ok || !r.body) return null;
    const chunks = [];
    let size = 0;
    for await (const c of r.body) {
      size += c.length;
      if (size > MAX) return null;
      chunks.push(Buffer.from(c));
    }
    const text = Buffer.concat(chunks).toString('utf8').replace(/^﻿/, '');
    if (!isVcard(text)) return null; // only ever pass on real vCards
    cache.set(url, { t: Date.now(), text });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return text;
  } catch {
    return null;
  }
}

// A vCard built from a card's profile and details.
function build(doc, pageUrl) {
  const p = doc.profile || {}, f = doc.fields || {};
  const e = v => String(v ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const name = String(p.name || '').trim(), parts = name.split(/\s+/);
  const last = parts.length > 1 ? parts.pop() : '', first = parts.join(' ');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${e(last)};${e(first)};;;`, `FN:${e(name || 'Contact')}`];
  if (p.company || p.department) lines.push(`ORG:${e(p.company)}${p.department ? ';' + e(p.department) : ''}`);
  if (p.title) lines.push(`TITLE:${e(p.title)}`);
  if (f.phone) lines.push(`TEL;TYPE=CELL,VOICE:${e(f.phone)}`);
  if (f.whatsapp && f.whatsapp !== f.phone) lines.push(`TEL;TYPE=CELL:${e(f.whatsapp)}`);
  if (f.email) lines.push(`EMAIL;TYPE=INTERNET:${e(f.email)}`);
  if (f.website) lines.push(`URL:${e(/^https?:\/\//i.test(f.website) ? f.website : 'https://' + f.website)}`);
  if (f.linkedin) lines.push(`URL;TYPE=LinkedIn:${e(f.linkedin)}`);
  if (pageUrl) lines.push(`URL;TYPE=Card:${e(pageUrl)}`);
  if (f.address) lines.push(`ADR;TYPE=WORK:;;${e(f.address)};;;;`);
  lines.push('END:VCARD');
  return lines.join('\r\n') + '\r\n';
}

// The vCard text behind a contact block, or null when there is none / it cannot be loaded.
// `doc` (the card as displayed) is needed for automatic vCards.
async function load(block, doc, pageUrl) {
  if (block.auto && doc) return build(doc, pageUrl);
  if (block.vcf) {
    const m = await mediaRepo.get(block.vcf.slice(7));
    if (m) return m.data.toString('utf8');
  }
  return block.url ? fetchRemote(block.url) : null;
}

function send(res, text, name) {
  const base = String(name || 'contact').replace(/[\r\n"\\/]+/g, ' ').trim().slice(0, 60) || 'contact';
  const ascii = base.replace(/[^\x20-\x7e]/g, '_');
  res.writeHead(200, {
    // text/x-vcard is the type Android's Contacts app registers for; iPhones accept it too.
    'Content-Type': 'text/x-vcard; charset=utf-8',
    'Content-Disposition': `inline; filename="${ascii}.vcf"; filename*=UTF-8''${encodeURIComponent(base)}.vcf`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(text);
}

module.exports = { storeUpload, load, send, build, isVcard, directUrl };
