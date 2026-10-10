// Small controlled inputs bound to a dotted path of the account being edited (see useAccountEditor).
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../icons.jsx';
import { getp } from '../../utils.js';

export const Field = ({ ed, path, placeholder, className = '', onBlur, label }) => (
  <input className={className} aria-label={label || placeholder} placeholder={placeholder}
    value={getp(ed.account, path) ?? ''} onChange={e => ed.set(path, e.target.value)} onBlur={onBlur} />
);

export function Slider({ ed, label, path, min, max, value, unit = '' }) {
  const v = value ?? getp(ed.account, path) ?? min;
  return (
    <div style={{ margin: '10px 0' }}>
      <b style={{ fontWeight: 600 }}>{label}</b>
      <div className="row">
        <input type="range" min={min} max={max} value={v} aria-label={label} onChange={e => ed.set(path, +e.target.value)} />
        <span className="tag" style={{ minWidth: 66, textAlign: 'center' }}>{v}{unit}</span>
      </div>
    </div>
  );
}

export const Switch = ({ ed, label, path }) => (
  <label className="sw">
    <span>{label}</span>
    <input type="checkbox" checked={!!getp(ed.account, path)} onChange={e => ed.set(path, e.target.checked)} />
    <i />
  </label>
);

// Segmented buttons: options = [[value, label], ...]
export const Seg = ({ ed, path, options }) => {
  const v = getp(ed.account, path);
  return (
    <div className="seg">
      {options.map(([k, l]) => <button key={k} className={v === k ? 'on' : ''} aria-pressed={v === k} onClick={() => ed.set(path, k)}>{l}</button>)}
    </div>
  );
};

// "•••" dropdown. Closes on outside click and after choosing an item.
export function Menu({ label = '•••', title = 'More', children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (!ref.current || !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className="mn" ref={ref}>
      <button aria-haspopup="menu" aria-expanded={open} title={title} aria-label={title} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>{label}</button>
      {open && <div role="menu" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}

// Centered picker window used by the icon picker and "Add a block".
export function Overlay({ title, onClose, children }) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="ov" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="md" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row">
          <h2 style={{ flex: 1, margin: 0, fontSize: 18, textTransform: 'none', color: 'var(--ink)' }}>{title}</h2>
          <button onClick={onClose} aria-label="Close"><Icon name="close" size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
