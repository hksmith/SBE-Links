import { useEffect, useState } from 'react';
import { useTick } from '../lib/live.js';

// "● Live · updated 4s ago": shows that a statistics screen refreshes by itself. Pulses on every update.
export function LiveBadge({ updated }) {
  useTick();
  const [since] = useState(() => Date.now());
  const [pulse, setPulse] = useState(false);
  useEffect(() => { if (!updated) return; setPulse(true); const t = setTimeout(() => setPulse(false), 900); return () => clearTimeout(t); }, [updated]);
  const s = Math.max(0, Math.round((Date.now() - (updated || since)) / 1000));
  return <span className={'live' + (pulse ? ' pulse' : '')} title="Numbers refresh by themselves every 10 seconds">
    <i />Live<small> · {s < 5 ? 'just now' : s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`}</small>
  </span>;
}
