// Form controls bound to a path in the account being edited, e.g. <Text path="profile.name" />.
import { createContext, useContext } from 'react';
import { getp, setp, cls } from '../lib/utils.js';
import { FONTS } from '../lib/constants.js';

export const EditorContext = createContext(null);
export const useEd = () => useContext(EditorContext);

// Sets `path` to `v`; `after(draft)` runs in the same change (used to switch a preset tab to “Custom”).
const useSetter = (path, after) => {
  const { set, update } = useEd();
  return v => (after ? update(d => { setp(d, path, v); after(d); }) : set(path, v));
};

export function Text({ path, placeholder, className, ...rest }) {
  const { cur, set } = useEd();
  return <input className={className} value={getp(cur, path) ?? ''} placeholder={placeholder} onChange={e => set(path, e.target.value)} {...rest} />;
}

export function Area({ path, placeholder }) {
  const { cur, set } = useEd();
  return <textarea value={getp(cur, path) ?? ''} placeholder={placeholder} onChange={e => set(path, e.target.value)} />;
}

export function FontSelect({ path, empty, after }) {
  const { cur } = useEd();
  const set = useSetter(path, after);
  const v = getp(cur, path) ?? '';
  return (
    <select value={v} style={v ? { fontFamily: `'${v}'` } : undefined} onChange={e => set(e.target.value)}>
      {empty && <option value="">{empty}</option>}
      {FONTS.map(f => <option key={f} style={{ fontFamily: `'${f}'` }}>{f}</option>)}
    </select>
  );
}

// Range slider with its value shown next to it. `value` overrides the stored value (for defaults).
export function Slider({ label, path, min, max, value, unit, gap = 8, after, step = 1 }) {
  const { cur } = useEd();
  const set = useSetter(path, after);
  const v = value ?? getp(cur, path) ?? min;
  return (
    <div style={{ margin: `${gap}px 0` }}>
      <b style={{ fontWeight: 600 }}>{label}</b>
      <div className="row">
        <input type="range" min={min} max={max} step={step} value={v} onChange={e => set(+e.target.value)} />
        <span className="tag" style={{ minWidth: 66, textAlign: 'center' }}><output>{v}</output>{unit}</span>
      </div>
    </div>
  );
}

// `value` overrides the stored value (for settings that are on by default).
export function Switch({ label, path, after, value }) {
  const { cur } = useEd();
  const set = useSetter(path, after);
  return <label className="sw"><span>{label}</span><input type="checkbox" checked={value ?? !!getp(cur, path)} onChange={e => set(e.target.checked)} /><i /></label>;
}

export function Color({ label, path, after, fallback = '#000000' }) {
  const { cur } = useEd();
  const set = useSetter(path, after);
  const v = getp(cur, path) || fallback;
  return <div className="cr"><span>{label} <code className="hex">{v}</code></span><input type="color" value={v} onChange={e => set(e.target.value)} /></div>;
}

// A 3×3 grid to pick a position: options = [[key, title], …] in reading order (9 of them, '' for an empty cell).
export function PosGrid({ path, options, value, fallback }) {
  const { cur, set } = useEd();
  const v = value ?? getp(cur, path) ?? fallback;
  return (
    <div className="posg">
      {options.map(([k, l], i) => k
        ? <button key={k} type="button" title={l} aria-label={l} className={cls(v === k && 'on')} onClick={() => set(path, k)}><i /><span>{l}</span></button>
        : <span key={'e' + i} />)}
    </div>
  );
}

// Segmented buttons that set `path` to one of the option keys: options = [[key, label], …]
export function Seg({ path, options, fallback }) {
  const { cur, set } = useEd();
  const v = String(getp(cur, path) ?? fallback);
  return <div className="seg">{options.map(([k, l]) => <button key={k} className={cls(v === k && 'on')} onClick={() => set(path, k)}>{l}</button>)}</div>;
}

// Segmented buttons driven by plain props (theme tabs, presets).
export function Tabs({ value, options, onPick }) {
  return <div className="seg">{options.map(k => <button key={k} className={cls(value === k && 'on')} onClick={() => onPick(k)}>{k}</button>)}</div>;
}
