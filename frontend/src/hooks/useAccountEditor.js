// State machine behind the editor: loads one account, applies edits, keeps undo history,
// autosaves shortly after the last change and warns before the tab is closed with unsaved work.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { setp } from '../utils.js';

const SAVE_DELAY = 1100;   // ms after the last edit
const HIST_DELAY = 600;    // ms after the last edit before a history snapshot is taken

export function useAccountEditor(id) {
  const [account, setAccount] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [status, setStatus] = useState('saved'); // saved | dirty | saving | failed
  const [, rerender] = useState(0);

  // Mutable bookkeeping that must not trigger renders or go stale inside timers.
  const live = useRef({ account: null, rev: 0, savedRev: 0 });
  const hist = useRef({ stack: [], i: 0 });
  const timers = useRef({});

  useEffect(() => {
    let dead = false;
    setAccount(null); setLoadError(null);
    api('/api/accounts/' + id).then(({ stats: st, ...acc }) => {
      if (dead) return;
      live.current = { account: acc, rev: 0, savedRev: 0 };
      hist.current = { stack: [JSON.stringify(acc)], i: 0 };
      setAccount(acc); setStats(st); setStatus('saved');
    }).catch(e => { if (!dead && e.status !== 401) setLoadError(e); });
    return () => { dead = true; };
  }, [id]);

  const save = useCallback(async () => {
    clearTimeout(timers.current.s);
    const L = live.current;
    if (!L.account || L.rev === L.savedRev) return true;
    const sent = L.rev;
    setStatus('saving');
    try {
      const r = await api('/api/accounts/' + L.account.id, { method: 'PUT', body: L.account });
      L.savedRev = Math.max(L.savedRev, sent);
      // The server keeps the old address when the requested one is invalid or taken.
      if (r.slug && r.slug !== L.account.slug) { L.account = { ...L.account, slug: r.slug }; setAccount(L.account); }
      setStatus(L.rev === L.savedRev ? 'saved' : 'dirty');
      return true;
    } catch (e) {
      if (e.status !== 401) setStatus('failed');
      return false;
    }
  }, []);

  const snapshot = useCallback(() => {
    const j = JSON.stringify(live.current.account), h = hist.current;
    if (j === h.stack[h.i]) return;
    h.stack = [...h.stack.slice(0, h.i + 1), j];
    h.i = h.stack.length - 1;
    rerender(n => n + 1);
  }, []);

  // Apply an edit: `fn` mutates a private copy of the account.
  const update = useCallback(fn => {
    const next = structuredClone(live.current.account);
    fn(next);
    live.current.account = next;
    live.current.rev++;
    setAccount(next);
    setStatus('dirty');
    clearTimeout(timers.current.h); timers.current.h = setTimeout(snapshot, HIST_DELAY);
    clearTimeout(timers.current.s); timers.current.s = setTimeout(save, SAVE_DELAY);
  }, [save, snapshot]);

  const set = useCallback((path, value) => update(a => setp(a, path, value)), [update]);

  const undo = useCallback(d => {
    clearTimeout(timers.current.h);
    snapshot(); // keep the very latest edit reachable
    const h = hist.current, n = h.i + d;
    if (n < 0 || n >= h.stack.length) return;
    h.i = n;
    const acc = JSON.parse(h.stack[n]);
    live.current.account = acc;
    live.current.rev++;
    setAccount(acc);
    setStatus('dirty');
    clearTimeout(timers.current.s); timers.current.s = setTimeout(save, 600);
  }, [save, snapshot]);

  const refreshStats = useCallback(async () => {
    const j = await api('/api/accounts/' + id);
    setStats(j.stats);
  }, [id]);

  // Leaving the editor: write out anything still pending.
  useEffect(() => () => { clearTimeout(timers.current.h); save(); }, [save]);

  useEffect(() => {
    if (status === 'saved') return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  const h = hist.current;
  return { account, stats, loadError, status, update, set, save, undo, canUndo: h.i > 0, canRedo: h.i < h.stack.length - 1, refreshStats };
}
