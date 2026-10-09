// Account editor: header + blocks ("Link in Bio" tab), live phone preview, autosave and undo.
import { S } from '../state.js';
import { api, getJson } from '../api.js';
import { ICONS, IC, tileHTML } from '../icons.js';
import { $, esc, O } from '../utils.js';
import { NAME, ICON, CAT, NEWB, Q, QS, FONTS, SL } from '../constants.js';
import { designUI } from './design.js';
import { statsUI } from './analytics.js';

export async function edit(id) {
  const j = await getJson('/api/accounts/' + id);
  S.stats = j.stats; delete j.stats;
  Object.assign(S, { cur: j, hist: [JSON.stringify(j)], hi: 0, tab: 'bio', open: null, dirty: false });
  $('#app').innerHTML = `<header class="top"><button data-a="back">${IC('back', 14)} Accounts</button><b id="tn"></b><span class="sp"></span><div class="dom"><span id="dm"></span><button data-a="cpl">Copy</button><button data-a="opn">Open ${IC('open', 13)}</button></div>
 <button id="nfcb" data-a="cpn">NFC link</button><button data-a="shr" class="pri">Share</button></header>
 <main><div class="ed"><div><div class="tb"><button data-a="undo" id="un">${IC('undo', 14)} Undo</button><button data-a="redo" id="rd">Redo ${IC('redo', 14)}</button><span class="grow"></span><small id="sv" style="color:var(--mut);align-self:center">Saved ✓</small></div>
 <div class="tabs">${[['bio', 'Link in Bio'], ['design', 'Design'], ['stats', 'Analytics']].map(([k, n]) => `<button data-tab="${k}">${n}</button>`).join('')}</div><div id="pn"></div></div>
 <div><div class="phone"><iframe id="fr" title="Preview"></iframe></div></div></div></main>`;
  re(); prev(); top();
}

export function top() {
  const { cur, hi, hist, tab } = S;
  $('#tn').textContent = cur.profile.name || 'Account';
  $('#dm').textContent = O + '/' + cur.slug;
  $('#un').disabled = hi < 1;
  $('#rd').disabled = hi >= hist.length - 1;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
}

const inp = (p, ph, v, c = '') => `<input class="${c}" data-p="${p}" value="${esc(v)}" placeholder="${ph}">`;

function itemsEd(b, i, isL) {
  const st = S.stats;
  return `<button class="alink" data-a="iadd" data-i="${i}">+ Add ${isL ? 'link' : 'icon'}</button>` + b.items.map((it, j) => `<div class="lc ${it.off ? 'off' : ''}" data-ld="${i}:${j}"><span class="dg ldg" title="Drag to reorder">⠿</span>
 <div class="lb">${inp(`blocks.${i}.items.${j}.title`, isL ? 'Title' : 'Label (e.g. Instagram)', it.title, 'lt')}${isL ? inp(`blocks.${i}.items.${j}.sub`, 'Subtitle (optional)', it.sub || '', 'ls') : ''}${inp(`blocks.${i}.items.${j}.url`, 'https://…', it.url, 'lu')}
 <div class="la"><span class="stt" title="Clicks">${IC('graph', 15)} ${st.byLink[it.id] || 0} clicks</span><span style="flex:1"></span>
 <details class="mn"><summary>${IC('dots', 15)}</summary><div><button data-a="idup" data-i="${i}" data-j="${j}">Duplicate</button><button data-a="irm" data-i="${i}" data-j="${j}">Delete</button></div></details>
 <button class="tg ${it.off ? '' : 'on'}" data-a="itg" data-i="${i}" data-j="${j}" title="${it.off ? 'Hidden' : 'Visible'}" aria-label="Show or hide"></button></div></div>
 <button class="itile" data-pick="${i}:${j}" title="Choose icon">${tileHTML(it)}</button></div>`).join('')
    + `<div class="chips">${isL ? Object.keys(Q).map(k => `<button data-a="q" data-i="${i}" data-q="${k}">${IC(Q[k][0], 14)} ${k}</button>`).join('') : Object.keys(QS).map(k => `<button data-a="qs" data-i="${i}" data-q="${k}">${IC(QS[k][0], 14)} ${k}</button>`).join('')}</div>`;
}

export function picker(i, j) {
  const it = S.cur.blocks[i].items[j], o = document.createElement('div');
  o.className = 'ov';
  let f = '';
  const draw = () => {
    const q = f.toLowerCase(), L = Object.entries(ICONS).filter(([k, v]) => v[3] !== 'u' && (k + ' ' + v[0]).toLowerCase().includes(q));
    const g = x => L.filter(([, v]) => v[3] === x).map(([k, v]) => `<button class="ib" data-ic="${k}" title="${esc(v[0])}">${IC(k, 28)}<span>${esc(v[0])}</span></button>`).join('');
    o.innerHTML = `<div class="md"><div class="row"><h2 style="flex:1;margin:0;font-size:18px;text-transform:none;color:var(--ink)">Choose an icon</h2><button data-x>${IC('close', 14)}</button></div>
  <input id="ms" placeholder="Search icons…" value="${esc(f)}" style="margin:12px 0 8px"><div class="row" style="margin-bottom:12px"><button data-iup>${IC('upload', 14)} Upload your own</button><button data-ic="">No icon</button></div>
  <h2>Social &amp; apps</h2><div class="ibs">${g('s') || '<small>No match</small>'}</div><h2>General</h2><div class="ibs">${g('g') || '<small>No match</small>'}</div></div>`;
    const s = o.querySelector('#ms');
    s.focus(); s.setSelectionRange(f.length, f.length);
    s.oninput = () => { f = s.value; draw(); };
  };
  o.onclick = e => {
    if (e.target === o || e.target.closest('[data-x]')) return o.remove();
    const c = e.target.closest('[data-ic]');
    if (c) { it.ico = c.dataset.ic; it.img = ''; it.icon = ''; o.remove(); re(); return changed(); }
    if (e.target.closest('[data-iup]')) { S.upload = 'ico:' + i + ':' + j; o.remove(); $('#fi').click(); }
  };
  document.body.appendChild(o);
  draw();
}

function bodyEd(b, i) {
  const t = b.type, st = S.stats;
  if (t === 'links') return itemsEd(b, i, 1);
  if (t === 'social') return itemsEd(b, i, 0);
  if (t === 'text') return `<textarea data-p="blocks.${i}.text" placeholder="Write something">${esc(b.text)}</textarea><div class="row" style="margin-top:8px"><select data-p="blocks.${i}.f"><option value="">Theme font</option>${FONTS.map(f => `<option ${f === b.f ? 'selected' : ''}>${f}</option>`).join('')}</select><button data-bxr="${i}" style="padding:2px 10px;font-size:12px">Reset</button></div>${SL('Text size', 'blocks.' + i + '.s', 8, 72, b.s || 16, 'px')}`;
  if (t === 'video') return inp(`blocks.${i}.url`, 'YouTube link', b.url);
  if (t === 'contact') return inp(`blocks.${i}.label`, 'Button label', b.label) + inp(`blocks.${i}.url`, 'Paste your vCard link (https://…)', b.url) + '<small class="hint">Create the vCard yourself, host it, and paste its link here. The button only shows once a link is set. Taps on it are counted.</small>' + `<small>${st.byLink[b.id] || 0} clicks</small>`;
  if (t === 'images') return `<div class="row" style="flex-wrap:wrap">${b.imgs.map((s, j) => `<div style="position:relative"><img class="th" src="${esc(s)}"><button data-a="imrm" data-i="${i}" data-j="${j}" style="position:absolute;top:-6px;right:-6px;padding:0 6px">✕</button></div>`).join('')}</div><button data-up="img:${i}" style="margin-top:8px">${IC('upload', 14)} Upload images</button>`;
  return '<small style="color:var(--mut)">Nothing to edit.</small>';
}

function hdrEd() {
  const { cur } = S, p = cur.profile;
  return `<div class="row" style="margin-bottom:8px">${p.photo ? `<img class="th" src="${esc(p.photo)}">` : ''}<button data-up="photo">${IC('upload', 14)} ${p.photo ? 'Change' : 'Upload'} photo</button>${p.photo ? '<button data-a="rmp" data-k="photo">Remove</button>' : ''}</div>
 ${inp('profile.name', 'Full name', p.name)}${inp('profile.title', 'Job title (e.g. Manager)', p.title)}${inp('profile.department', 'Department', p.department)}${inp('profile.company', 'Company name', p.company)}<textarea data-p="profile.bio" placeholder="Short bio (optional)">${esc(p.bio)}</textarea>
 <div class="row" style="margin-bottom:4px">${p.logo ? `<img class="th" src="${esc(p.logo)}" style="object-fit:contain;background:#fff">` : ''}<button data-up="logo">${IC('upload', 14)} ${p.logo ? 'Change' : 'Upload'} company logo</button>${p.logo ? '<button data-a="rmp" data-k="logo">Remove</button>' : ''}</div>
 <small class="hint">The company logo shows in the top-right corner of the page.</small>
 ${p.logo ? `<div class="lgc"><h2 style="margin:10px 0 0">Logo size &amp; crop</h2>${SL('Size (% of page width)', 'profile.logoSize', 10, 45, Math.min(p.logoSize ?? 30, 45), '%')}${SL('Crop height (%)', 'profile.logoH', 15, 150, p.logoH ?? 40, '%')}${SL('Zoom (%)', 'profile.logoZoom', 50, 300, p.logoZoom ?? 100, '%')}${SL('Move left / right', 'profile.logoX', -50, 50, p.logoX ?? 0, '%')}${SL('Move up / down', 'profile.logoY', -50, 50, p.logoY ?? 0, '%')}<button data-a="rlogo">Reset logo</button></div>` : ''}
 <small style="color:var(--mut)">Page address (don’t change after programming the NFC card)</small>${inp('slug', 'page-address', cur.slug)}
 <small style="color:var(--mut)">NFC card URL</small><div class="row"><input readonly value="${O}/n/${esc(cur.slug)}"><button data-cp="${O}/n/${esc(cur.slug)}">Copy</button></div>`;
}

// Re-renders the active editor tab.
export function re() {
  const P = $('#pn'), { cur, open, tab } = S;
  top();
  if (tab === 'bio') {
    P.innerHTML = `<button class="blk" data-a="add">+ Add block</button><div id="bl"><div class="bc"><div class="bh" data-t="hdr"><span style="width:12px"></span><span class="chip">${IC('profile', 18)}</span><b>Header</b><i></i></div>${open === 'hdr' ? `<div class="bd">${hdrEd()}</div>` : ''}</div>
  ${cur.blocks.map((b, i) => `<div class="bc ${b.off ? 'off' : ''}" data-d="${i}"><div class="bh" data-t="${b.id}"><span class="dg" title="Drag">⠿</span><span class="chip">${IC(ICON[b.type], 18)}</span><b>${NAME[b.type]}</b><i></i><details class="mn"><summary>•••</summary><div><button data-a="dup" data-i="${i}">Duplicate</button><button data-a="rm" data-i="${i}">Delete</button></div></details><button data-a="eye" data-i="${i}">${IC(b.off ? 'eye-off' : 'eye', 16)}</button></div>${open === b.id ? `<div class="bd">${bodyEd(b, i)}</div>` : ''}</div>`).join('')}</div>`;
  } else if (tab === 'design') designUI(P);
  else statsUI(P);
}

/* ---------- autosave, preview, undo ---------- */
// Call after every change: refreshes the preview, records undo history and saves shortly after.
export function changed() {
  const T = S.timers;
  S.dirty = true;
  $('#sv').textContent = 'Unsaved…';
  clearTimeout(T.p); T.p = setTimeout(prev, 300);
  clearTimeout(T.h); T.h = setTimeout(() => {
    const j = JSON.stringify(S.cur);
    if (j !== S.hist[S.hi]) { S.hist = S.hist.slice(0, S.hi + 1); S.hist.push(j); S.hi++; top(); }
  }, 600);
  clearTimeout(T.s); T.s = setTimeout(save, 1100);
}

export async function save() {
  if (!S.cur) return;
  $('#sv').textContent = 'Saving…';
  try {
    const r = await api('/api/accounts/' + S.cur.id, 'PUT', S.cur);
    if (!r.ok) throw new Error();
    const j = await r.json();
    S.cur.slug = j.slug; S.dirty = false;
    $('#sv').textContent = 'Saved ✓';
    top();
  } catch {
    const sv = $('#sv'); if (sv) sv.textContent = 'Save failed';
  }
}

export async function prev() {
  if (!S.cur) return;
  const r = await api('/api/preview', 'POST', S.cur);
  const fr = $('#fr'); if (fr) fr.srcdoc = await r.text();
}

export function undo(d) {
  const n = S.hi + d;
  if (n < 0 || n >= S.hist.length) return;
  S.hi = n; S.cur = JSON.parse(S.hist[n]);
  re(); prev();
  clearTimeout(S.timers.s); S.timers.s = setTimeout(save, 600);
  $('#sv').textContent = 'Unsaved…';
}

// "Add a block" picker
export function addBlockModal() {
  const o = document.createElement('div');
  o.className = 'ov';
  let f = '';
  const draw = () => {
    o.innerHTML = `<div class="md"><div class="row"><h2 style="flex:1;margin:0;font-size:18px;text-transform:none;color:var(--ink)">Add a block</h2><button data-x>${IC('close', 14)}</button></div><input id="ms" placeholder="Search blocks…" value="${esc(f)}" style="margin:12px 0"><div class="tiles">${CAT.filter(c => (NAME[c[0]] + c[1]).toLowerCase().includes(f.toLowerCase())).map(c => `<button class="tile" data-n="${c[0]}"><span class="chip">${IC(ICON[c[0]], 20)}</span><b>${NAME[c[0]].split(' –')[0]}</b><small>${c[1]}</small></button>`).join('')}</div></div>`;
    const s = o.querySelector('#ms');
    s.focus(); s.setSelectionRange(f.length, f.length);
    s.oninput = () => { f = s.value; draw(); };
  };
  o.onclick = e => {
    if (e.target === o || e.target.closest('[data-x]')) return o.remove();
    const n = e.target.closest('[data-n]');
    if (n) {
      const b = { id: Math.random().toString(36).slice(2, 10), type: n.dataset.n, off: false, ...NEWB[n.dataset.n]() };
      S.cur.blocks.push(b); S.open = b.id; o.remove(); re(); changed();
    }
  };
  document.body.appendChild(o);
  draw();
}
