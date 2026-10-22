// Settings (admins): the system's name, logo and colours, and the footer shown on every page.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext.js';
import { send } from '../lib/api.js';
import { pickFiles, toData } from '../lib/utils.js';
import { toast } from '../lib/toast.js';
import { PRESETS, DEFAULT_SYSTEM, applyTheme, SystemLogo } from '../lib/theme.jsx';
import { Icon } from '../components/Icon.jsx';
import { PageHeader } from '../components/TopBar.jsx';
import { BrandingCard } from './BrandingCard.jsx';

export function Settings() {
  return <>
    <PageHeader title="Settings" sub="How the system looks: its name, logo, colours and footer." />
    <main style={{ maxWidth: 980 }}>
      <SystemCard />
      <BrandingCard />
    </main>
  </>;
}

function SystemCard() {
  const { system, setSystem } = useApp();
  const [d, setD] = useState(system); // draft
  const [busy, setBusy] = useState(false);
  const saved = useRef(system);
  saved.current = system;
  useEffect(() => { setD(system); }, [system]);
  // Colours are tried out live on the whole app; leaving without saving puts the saved ones back.
  useEffect(() => { applyTheme(d); }, [d]);
  useEffect(() => () => applyTheme(saved.current), []);

  const set = patch => setD(x => ({ ...x, ...patch }));
  const changed = ['name', 'logo', 'accent', 'accent2', 'sidebar'].some(k => d[k] !== system[k]);

  const save = async () => {
    setBusy(true);
    try {
      setSystem(await send('/api/system', 'PUT', { ...d, name: d.name.trim() }, 'Could not save the settings'));
      toast('Settings saved');
    } catch (e) { toast(e.message, { error: true }); }
    setBusy(false);
  };
  const upload = async () => {
    const [f] = await pickFiles({ accept: 'image/*' });
    if (f) set({ logo: await toData(f, 256, 'image/png') });
  };

  return (
    <div className="card">
      <h2>System</h2>
      <div className="sys-grid">
        <div>
          <label className="fl" htmlFor="sys-name">System name</label>
          <input id="sys-name" maxLength={60} value={d.name} onChange={e => set({ name: e.target.value })} placeholder={DEFAULT_SYSTEM.name} />
          <small className="hint">Shown in the menu, the browser tab and on the sign-in page.</small>

          <label className="fl" style={{ marginTop: 14 }}>System logo</label>
          <div className="row" style={{ gap: 12 }}>
            <SystemLogo system={d} size={56} />
            <button onClick={upload}><Icon k="upload" size={14} /> {d.logo ? 'Change' : 'Upload'} logo</button>
            {d.logo && <button onClick={() => set({ logo: '' })}>Remove</button>}
          </div>
          <small className="hint">A square image works best. Without one, the first letter of the name is shown. Clicking the logo always opens the dashboard.</small>

          <label className="fl" style={{ marginTop: 14 }}>Menu style</label>
          <div className="seg" style={{ maxWidth: 260 }}>
            <button className={d.sidebar === 'dark' ? 'on' : ''} onClick={() => set({ sidebar: 'dark' })}>Dark</button>
            <button className={d.sidebar === 'light' ? 'on' : ''} onClick={() => set({ sidebar: 'light' })}>Light</button>
          </div>
        </div>

        <div>
          <label className="fl">Theme colours</label>
          <div className="presets">
            {PRESETS.map(([n, a, b]) => (
              <button key={n} className={d.accent === a && d.accent2 === b ? 'on' : ''} onClick={() => set({ accent: a, accent2: b })}>
                <i style={{ background: `linear-gradient(135deg,${a},${b})` }} /><span>{n}</span>
              </button>
            ))}
          </div>
          <div className="cr"><span>Main colour</span><input type="color" value={d.accent} onChange={e => set({ accent: e.target.value })} /></div>
          <div className="cr"><span>Second colour</span><input type="color" value={d.accent2} onChange={e => set({ accent2: e.target.value })} /></div>
          <label className="fl" style={{ marginTop: 6 }}>Preview</label>
          <div className="sys-prev" data-sb={d.sidebar}>
            <div className="sp-side"><SystemLogo system={d} size={22} /><b>{d.name || DEFAULT_SYSTEM.name}</b><i className="on" /><i /><i /></div>
            <div className="sp-main"><button className="pri">Button</button><span className="tag">Tag</span><div className="bar"><i style={{ width: '62%' }} /></div></div>
          </div>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={() => setD({ ...d, accent: DEFAULT_SYSTEM.accent, accent2: DEFAULT_SYSTEM.accent2, sidebar: DEFAULT_SYSTEM.sidebar })} disabled={busy}>Default colours</button>
        {changed && <button onClick={() => setD(system)} disabled={busy}>Cancel</button>}
        <button className="pri" disabled={!changed || busy} onClick={save}>Save</button>
      </div>
    </div>
  );
}
