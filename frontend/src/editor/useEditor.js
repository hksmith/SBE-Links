// State of the editor: the document being edited, autosave, undo/redo history, live preview and uploads.
// kind: 'account' (a card), 'page' (a company page) or 'template' (a company's card design).
// All three have the same shape ({ id, profile, fields, theme, blocks }), so the same screens edit them.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getJson, send, uploadImage } from '../lib/api.js';
import { setp, toData, imageSize, pickFiles } from '../lib/utils.js';
import { toast } from '../lib/toast.js';
import { navigate } from '../lib/router.js';

const clone = o => JSON.parse(JSON.stringify(o));
const NO_STATS = { views: 0, taps: 0, clicks: 0, last: 0, days: [], byLink: {}, dev: {}, src: {}, recent: [] };
const urlOf = (id, kind) => (kind === 'page' || kind === 'template' ? `/api/companies/${id}/${kind}` : '/api/accounts/' + id);

export function useEditor(id, kind = 'account') {
  const URL = urlOf(id, kind);
  const [cur, setCurState] = useState(null);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('Saved ✓');
  const [hist, setHistState] = useState({ list: [], i: 0 });
  const [preview, setPreview] = useState('');

  // Refs hold the latest values for timers and async callbacks.
  const curRef = useRef(null), histRef = useRef(hist), dirty = useRef(false), version = useRef(0), timers = useRef({});
  const setCur = c => { curRef.current = c; setCurState(c); };
  const setHist = h => { histRef.current = h; setHistState(h); };

  const refreshPreview = useCallback(async () => {
    const c = curRef.current;
    if (!c) return;
    try {
      const r = await api('/api/preview', 'POST', c);
      if (r.ok) setPreview(await r.text());
    } catch { /* keep the old preview */ }
  }, []);

  const save = useCallback(async () => {
    const c = curRef.current;
    if (!c) return;
    clearTimeout(timers.current.s);
    const v = version.current;
    setStatus('Saving…');
    try {
      const j = await send(URL, 'PUT', c);
      if (curRef.current && j.slug && (j.slug !== curRef.current.slug || j.path !== curRef.current.path)) setCur({ ...curRef.current, slug: j.slug, path: j.path });
      if (version.current === v) { dirty.current = false; setStatus('Saved ✓'); } // nothing changed while saving
      else setStatus('Unsaved…');
    } catch {
      setStatus('Save failed');
    }
  }, [URL]);

  // Call after every change: refreshes the preview, records undo history and saves shortly after.
  const changed = useCallback(() => {
    const T = timers.current;
    dirty.current = true; version.current++;
    setStatus('Unsaved…');
    clearTimeout(T.p); T.p = setTimeout(refreshPreview, 300);
    clearTimeout(T.h); T.h = setTimeout(() => {
      const j = JSON.stringify(curRef.current), h = histRef.current;
      if (j !== h.list[h.i]) { const list = [...h.list.slice(0, h.i + 1), j]; setHist({ list, i: list.length - 1 }); }
    }, 600);
    clearTimeout(T.s); T.s = setTimeout(save, 1100);
  }, [refreshPreview, save]);

  // update(draft => { draft.profile.name = 'x' }) – edit a copy of the account, then autosave.
  const update = useCallback(recipe => {
    const d = clone(curRef.current);
    recipe(d);
    setCur(d);
    changed();
  }, [changed]);
  const set = useCallback((path, value) => update(d => setp(d, path, value)), [update]);

  const undo = useCallback(step => {
    const h = histRef.current, n = h.i + step, T = timers.current;
    if (n < 0 || n >= h.list.length) return;
    clearTimeout(T.h);
    setHist({ ...h, i: n });
    setCur(JSON.parse(h.list[n]));
    refreshPreview();
    dirty.current = true; version.current++;
    clearTimeout(T.s); T.s = setTimeout(save, 600);
    setStatus('Unsaved…');
  }, [refreshPreview, save]);

  const reloadStats = useCallback(async () => {
    try { setStats((await getJson(URL)).stats || NO_STATS); } catch { /* keep old numbers */ }
  }, [URL]);

  // Load the account; save pending changes when leaving the editor.
  useEffect(() => {
    let live = true;
    getJson(URL).then(j => {
      if (!live) return;
      const { stats: s, ...acc } = j;
      setStats(s || NO_STATS); setCur({ kind, ...acc }); setHist({ list: [JSON.stringify(acc)], i: 0 });
      refreshPreview();
    }).catch(() => { if (live) { toast('That account was not found', { error: true }); navigate('/'); } });
    const T = timers.current;
    return () => {
      live = false;
      Object.values(T).forEach(clearTimeout);
      if (dirty.current) save();
    };
  }, [URL, kind, refreshPreview, save]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    const warn = e => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // Image uploads. target: 'bg' | 'photo' | 'logo' | 'img:<block>' | 'ico:<block>:<item>'
  // Call straight from a click handler: the file chooser has to open before any await.
  const upload = useCallback(async target => {
    const files = await pickFiles({ accept: 'image/*', multiple: target.startsWith('img:') });
    if (!files.length) return;
    setStatus('Uploading…');
    try {
      if (target === 'bg') {
        const url = await uploadImage(await toData(files[0], 1200, 'image/jpeg'));
        update(d => { d.theme.bgImage = url; });
      } else if (target === 'photo') {
        const url = await uploadImage(await toData(files[0], 900, 'image/jpeg'));
        update(d => { d.profile.photo = url; });
      } else if (target === 'logo') {
        const data = await toData(files[0], 600, 'image/png'), [w, h] = await imageSize(data), url = await uploadImage(data);
        update(d => Object.assign(d.profile, { logo: url, logoH: Math.max(15, Math.min(150, Math.round((h / w) * 100))), logoSize: 30, logoZoom: 100, logoX: 0, logoY: 0 }));
      } else if (target.startsWith('ico:')) {
        const [, i, j] = target.split(':').map(Number), url = await uploadImage(await toData(files[0], 96, 'image/png'));
        update(d => Object.assign(d.blocks[i].items[j], { img: url, ico: '', icon: '' }));
      } else if (target.startsWith('img:')) {
        const i = +target.split(':')[1], urls = [];
        for (const f of files) urls.push(await uploadImage(await toData(f, 1000, 'image/jpeg')));
        update(d => { d.blocks[i].imgs.push(...urls); });
      }
    } catch (err) {
      toast(err.message || 'Upload failed', { error: true });
      setStatus(dirty.current ? 'Unsaved…' : 'Saved ✓');
    }
  }, [update]);

  // .vcf upload for a "Save contact" block.
  const uploadVcf = useCallback(async i => {
    const [f] = await pickFiles({ accept: '.vcf,.vcard,text/vcard,text/x-vcard' });
    if (!f) return;
    if (f.size > 1e6) return toast('The vCard file is too large (max 1 MB).', { error: true });
    try {
      const j = await send('/api/vcard', 'POST', { text: await f.text() }, 'Upload failed');
      update(d => Object.assign(d.blocks[i], { vcf: j.url, vcfName: f.name }));
      toast('vCard uploaded');
    } catch (err) { toast(err.message || 'Upload failed', { error: true }); }
  }, [update]);

  return {
    cur, curRef, stats, status, preview, dirty,
    canUndo: hist.i > 0, canRedo: hist.i < hist.list.length - 1,
    update, set, undo, save, reloadStats, upload, uploadVcf,
  };
}
