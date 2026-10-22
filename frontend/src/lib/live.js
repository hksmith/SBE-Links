// Live statistics: reloads a screen's data every few seconds while the page is visible
// (and right away when you come back to the tab), so numbers update by themselves.
import { useEffect, useRef, useState } from 'react';

export const LIVE_MS = 10e3;

export function useLive(load, ms = LIVE_MS) {
  const [updated, setUpdated] = useState(0);
  const ref = useRef(load);
  ref.current = load;
  useEffect(() => {
    let stop = false, busy = false;
    const run = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try { await ref.current(); if (!stop) setUpdated(Date.now()); } catch { /* keep the last numbers */ }
      busy = false;
    };
    const t = setInterval(run, ms);
    const vis = () => { if (!document.hidden) run(); };
    document.addEventListener('visibilitychange', vis);
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [ms]);
  return updated;
}

// Re-renders every second, for "updated 5 s ago" labels.
export function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set(x => x + 1), ms); return () => clearInterval(t); }, [ms]);
}
