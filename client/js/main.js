// Admin app entry: loads icons, shows the dashboard, and wires up all UI events (event delegation).
import { S } from './state.js';
import { api, getJson, uploadImage } from './api.js';
import { loadIcons, tileHTML, guess } from './icons.js';
import { $, O, rid, setp, copy, toData, imageSize } from './utils.js';
import { THEMES, mkT, FP, BS, PRE, Q, QS } from './constants.js';
import { dash, rows, newAccount, deleteAccount } from './views/dashboard.js';
import { edit, re, changed, save, undo, picker, addBlockModal } from './views/editor.js';
import { confirmDialog } from './components/dialog.js';
import { toast } from './components/toast.js';

/* ---------- image uploads (hidden <input type=file id=fi>) ---------- */
$('#fi').addEventListener('change', async e => {
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length) return;
  const target = S.upload, cur = S.cur, sv = $('#sv');
  if (sv) sv.textContent = 'Uploading…';
  try {
    if (target === 'brand') {
      await api('/api/brand', 'PUT', { logo: await toData(files[0], 240, 'image/png') });
      return dash();
    }
    if (target === 'bg') cur.theme.bgImage = await uploadImage(await toData(files[0], 1200, 'image/jpeg'));
    else if (target === 'photo') cur.profile.photo = await uploadImage(await toData(files[0], 900, 'image/jpeg'));
    else if (target === 'logo') {
      const p = cur.profile, data = await toData(files[0], 600, 'image/png'), [w, h] = await imageSize(data);
      p.logo = await uploadImage(data);
      Object.assign(p, { logoH: Math.max(15, Math.min(150, Math.round((h / w) * 100))), logoSize: 30, logoZoom: 100, logoX: 0, logoY: 0 });
    } else if (target.startsWith('ico:')) {
      const [, i, j] = target.split(':'), it = cur.blocks[+i].items[+j];
      it.img = await uploadImage(await toData(files[0], 96, 'image/png'));
      it.ico = ''; it.icon = '';
    } else if (target.startsWith('img:')) {
      const i = +target.split(':')[1];
      for (const f of files) cur.blocks[i].imgs.push(await uploadImage(await toData(f, 1000, 'image/jpeg')));
    }
    re(); changed();
  } catch (err) {
    toast(err.message || 'Upload failed', { error: true });
    if (sv) sv.textContent = S.dirty ? 'Unsaved…' : 'Saved ✓';
  }
});

/* ---------- typing in any field with data-p="path" updates the account ---------- */
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') return rows(t.value);
  const p = t.dataset.p;
  if (!p || !S.cur) return;
  setp(S.cur, p, t.type === 'checkbox' ? t.checked : t.type === 'range' ? +t.value : t.value);
  if (t.type === 'range') { const o = t.parentElement.querySelector('output'); if (o) o.textContent = t.value; }
  if (p === 'slug') $('#dm').textContent = O + '/' + t.value;
  if (p === 'profile.name') $('#tn').textContent = t.value;
  changed();
});

/* ---------- clicks ---------- */
document.addEventListener('click', async e => {
  const t = e.target, b = t.closest('button'), d = b ? b.dataset : {};
  const cur = S.cur;
  if (t.closest('.dlg-ov')) return; // dialogs handle their own clicks
  if (d.cp !== undefined && d.cp !== '') { e.stopPropagation(); return copy(d.cp, b); }
  if (d.pick) { const [pi, pj] = d.pick.split(':').map(Number); return picker(pi, pj); }
  if (d.a === 'rmbrand') { await api('/api/brand', 'PUT', { logo: '' }); return dash(); }
  if (d.up) { S.upload = d.up; return $('#fi').click(); }
  if (d.tab) { S.tab = d.tab; if (S.tab === 'stats') S.stats = (await getJson('/api/accounts/' + cur.id)).stats; return re(); }
  if (d.ts) { const [k, v] = d.ts.split(':'); if (k === 'th') S.thTab = v; else S.bsTab = v; return re(); }
  if (d.th) { const [c, i] = d.th.split(':'); Object.assign(cur.theme, mkT(THEMES[c][+i])); re(); return changed(); }
  if (d.txr) { cur.theme.tx[d.txr] = { f: '', s: 0 }; re(); return changed(); }
  if (d.bxr !== undefined) { cur.blocks[+d.bxr].f = ''; cur.blocks[+d.bxr].s = 0; re(); return changed(); }
  if (d.fp) { if (FP[d.fp]) { [cur.theme.disp, cur.theme.body] = FP[d.fp]; re(); changed(); } return; }
  if (d.bs) { Object.assign(cur.theme, BS[d.bs]); re(); return changed(); }
  if (d.set) { const i = d.set.indexOf('='), v = d.set.slice(i + 1); setp(cur, d.set.slice(0, i), /^\d+$/.test(v) ? +v : v); re(); return changed(); }
  if (d.rmbg) { cur.theme.bgImage = ''; re(); return changed(); }
  if (d.pre) { if (d.pre !== 'Custom') Object.assign(cur.theme, PRE[d.pre]); re(); return changed(); }
  if (d.a === 'new') return newAccount();
  if (d.a === 'del') { e.stopPropagation(); return deleteAccount(d.id, d.name); }
  if (d.a === 'back') { if (S.dirty) await save(); return dash(); }
  if (d.a === 'cpl') return copy(O + '/' + cur.slug, b);
  if (d.a === 'cpn') return copy(O + '/n/' + cur.slug, b);
  if (d.a === 'opn') return window.open('/' + cur.slug, '_blank');
  if (d.a === 'shr') { const u = O + '/' + cur.slug; return navigator.share ? navigator.share({ url: u, title: cur.profile.name }).catch(() => {}) : copy(u, b); }
  if (d.a === 'undo') return undo(-1);
  if (d.a === 'redo') return undo(1);
  if (d.a === 'add') return addBlockModal();

  if (cur && d.a) {
    const i = +d.i, j = +d.j, B = cur.blocks[i], L = B && B.items;
    if (d.a === 'eye') B.off = !B.off;
    else if (d.a === 'rm') {
      if (!(await confirmDialog({ title: 'Delete this block?', text: 'You can still undo this afterwards.', confirm: 'Delete block' }))) return;
      cur.blocks.splice(i, 1);
    } else if (d.a === 'dup') { const c = JSON.parse(JSON.stringify(B)); c.id = rid(); (c.items || []).forEach(x => (x.id = rid())); cur.blocks.splice(i + 1, 0, c); }
    else if (d.a === 'irm') L.splice(j, 1);
    else if (d.a === 'itg') L[j].off = !L[j].off;
    else if (d.a === 'idup') L.splice(j + 1, 0, { ...JSON.parse(JSON.stringify(L[j])), id: rid() });
    else if (d.a === 'iadd') L.unshift({ id: rid(), ico: B.type === 'social' ? '' : 'link', title: '', sub: '', url: '', off: false });
    else if (d.a === 'q') L.push({ id: rid(), ico: Q[d.q][0], title: Q[d.q][1], sub: '', url: Q[d.q][2], off: false });
    else if (d.a === 'qs') L.push({ id: rid(), ico: QS[d.q][0], title: d.q, url: QS[d.q][1], off: false });
    else if (d.a === 'imrm') B.imgs.splice(j, 1);
    else if (d.a === 'rmp') cur.profile[d.k] = '';
    else if (d.a === 'rlogo') Object.assign(cur.profile, { logoSize: 30, logoZoom: 100, logoX: 0, logoY: 0 });
    else return;
    re();
    return changed();
  }
  const h = t.closest('.bh');
  if (h && !b && !t.closest('details') && !t.closest('.dg')) { S.open = S.open === h.dataset.t ? null : h.dataset.t; return re(); }
  const row = t.closest('.acc');
  if (row && !b) edit(row.dataset.e);
});

/* ---------- drag & drop: reorder blocks (.bc) and links inside a block (.lc) ---------- */
let dr = null, ldr = null;
document.addEventListener('pointerdown', e => {
  if (e.target.classList && e.target.classList.contains('dg')) { const l = e.target.closest('.lc'); (l || e.target.closest('.bc')).draggable = true; }
});
document.addEventListener('dragstart', e => {
  const l = e.target.closest && e.target.closest('[data-ld]');
  if (l) { ldr = l.dataset.ld.split(':').map(Number); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'x'); } catch {} return; }
  const c = e.target.closest && e.target.closest('[data-d]');
  if (c) { dr = +c.dataset.d; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'x'); } catch {} }
});
document.addEventListener('dragover', e => {
  if (ldr) { e.preventDefault(); document.querySelectorAll('.lc.over').forEach(x => x.classList.remove('over')); const c = e.target.closest('[data-ld]'); if (c) c.classList.add('over'); return; }
  if (dr == null) return;
  e.preventDefault();
  document.querySelectorAll('.bc.over').forEach(x => x.classList.remove('over'));
  const c = e.target.closest('[data-d]'); if (c) c.classList.add('over');
});
document.addEventListener('drop', e => {
  const cur = S.cur;
  if (ldr) {
    e.preventDefault();
    const c = e.target.closest('[data-ld]');
    if (c) { const [ti, tj] = c.dataset.ld.split(':').map(Number); if (ti === ldr[0]) { const L = cur.blocks[ti].items, [m] = L.splice(ldr[1], 1); L.splice(tj, 0, m); changed(); } }
    ldr = null; re(); return;
  }
  if (dr == null) return;
  e.preventDefault();
  const c = e.target.closest('[data-d]');
  if (c) { const [m] = cur.blocks.splice(dr, 1); cur.blocks.splice(+c.dataset.d, 0, m); changed(); }
  dr = null; re();
});
document.addEventListener('dragend', () => { dr = null; ldr = null; if (S.cur && S.tab === 'bio') re(); });

/* ---------- auto-pick an icon when a link URL is entered ---------- */
document.addEventListener('change', e => {
  const t = e.target, m = /^blocks\.(\d+)\.items\.(\d+)\.url$/.exec(t.dataset.p || '');
  if (!m || !S.cur) return;
  const it = S.cur.blocks[+m[1]].items[+m[2]];
  if (it.img || (it.ico && it.ico !== 'link' && it.ico !== 'globe')) return;
  const g = guess(it.url);
  if (g && g !== it.ico) {
    it.ico = g; it.icon = '';
    const tl = document.querySelector(`[data-pick="${m[1]}:${m[2]}"]`);
    if (tl) tl.innerHTML = tileHTML(it);
    changed();
  }
});

window.onbeforeunload = () => (S.dirty ? 'Unsaved changes' : undefined);

(async () => {
  loadIcons(await getJson('/api/icons'));
  dash();
})();
