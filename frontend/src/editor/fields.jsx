// Form controls bound to a path in the account being edited, e.g. <Text path="profile.name" />.
import { createContext, useContext } from 'react';
import { getp, cls } from '../lib/utils.js';
import { FONTS } from '../lib/constants.js';

export const EditorContext = createContext(null);
export const useEd = () => useContext(EditorContext);

export function Text({ path, placeholder, className, ...rest }) {
  const { cur, set } = useEd();
  return <input className={className} value={getp(cur, path) ?? ''} placeholder={placeholder} onChange={e => set(path, e.target.value)} {...rest} />;
}

export function Area({ path, placeholder }) {
  const { cur, set } = useEd();
  return <textarea value={getp(cur, path) ?? ''} placeholder={placeholder} onChange={e => set(path, e.target.value)} />;
}

export function FontSelect({ path, empty }) {
  const { cur, set } = useEd();
  return (
    <select value={getp(cur, path) ?? ''} onChange={e => set(path, e.target.value)}>
      {empty && <option value="">{empty}</option>}
      {FONTS.map(f => <option key={f}>{f}</option>)}
    </select>
  );
}

// Range slider with its value shown next to it. `value` overrides the stored value (for defaults).
export function Slider({ label, path, min, max, value, unit, gap = 8 }) {
  const { cur, set } = useEd();
  const v = value ?? getp(cur, path) ?? min;
  return (
    <div style={{ margin: `${gap}px 0` }}>
      <b style={{ fontWeight: 600 }}>{label}</b>
      <div className="row">
        <input type="range" min={min} max={max} value={v} onChange={e => set(path, +e.target.value)} />
        <span className="tag" style={{ minWidth: 66, textAlign: 'center' }}><output>{v}</output>{unit}</span>
      </div>
    </div>
  );
}

export function Switch({ label, path }) {
  const { cur, set } = useEd();
  return <label className="sw"><span>{label}</span><input type="checkbox" checked={!!getp(cur, path)} onChange={e => set(path, e.target.checked)} /><i /></label>;
}

export function Color({ label, path }) {
  const { cur, set } = useEd();
  return <div className="cr"><span>{label}</span><input type="color" value={getp(cur, path) || '#000000'} onChange={e => set(path, e.target.value)} /></div>;
}

// Segmented buttons that set `path` to one of the option keys: options = [[key, label], …]
export function Seg({ path, options }) {
  const { cur, set } = useEd();
  const v = String(getp(cur, path));
  return <div className="seg">{options.map(([k, l]) => <button key={k} className={cls(v === k && 'on')} onClick={() => set(path, k)}>{l}</button>)}</div>;
}

// Segmented buttons driven by plain props (theme tabs, presets).
export function Tabs({ value, options, onPick }) {
  return <div className="seg">{options.map(k => <button key={k} className={cls(value === k && 'on')} onClick={() => onPick(k)}>{k}</button>)}</div>;
}
