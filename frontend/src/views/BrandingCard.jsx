// Dashboard card (admins): footer logo + its size, and the "Powered by …" footer statement.
// These show at the bottom of every link tree page and across the admin.
import { useEffect, useState } from 'react';
import { useApp } from '../AppContext.js';
import { send } from '../lib/api.js';
import { pickFiles, toData } from '../lib/utils.js';
import { toast } from '../lib/toast.js';
import { Icon } from '../components/Icon.jsx';
import { BrandLine } from '../components/TopBar.jsx';

export const DEFAULT_TEXT = 'Powered by Shaggar BPO Enterprise';

export function BrandingCard() {
  const { brand, setBrand } = useApp();
  const [text, setText] = useState(brand.text);
  const [size, setSize] = useState(brand.logoSize);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(brand.text); setSize(brand.logoSize); }, [brand.text, brand.logoSize]);

  const changed = text.trim() !== brand.text || size !== brand.logoSize;
  const put = async (body, msg) => {
    setBusy(true);
    try {
      const r = await send('/api/brand', 'PUT', body, 'Could not save');
      setBrand({ logo: r.logo, logoSize: r.logoSize, text: r.text });
      if (msg) toast(msg);
    } catch (e) { toast(e.message, { error: true }); }
    setBusy(false);
  };

  const upload = async () => {
    const [f] = await pickFiles({ accept: 'image/*' });
    if (!f) return;
    put({ logo: await toData(f, 480, 'image/png') }, 'Logo updated');
  };

  return (
    <div className="card">
      <h2>Footer &amp; branding</h2>
      <small className="hint" style={{ marginTop: -4 }}>Shown at the bottom of every link tree page and the admin pages. The logo also appears in this header.</small>

      <div className="brand-grid">
        <div>
          <label className="fl">Footer logo</label>
          <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
            <div className="bl">{brand.logo ? <img src={brand.logo} alt="Footer logo" /> : <small style={{ color: 'var(--mut)' }}>No logo</small>}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button onClick={upload} disabled={busy}><Icon k="upload" size={14} /> {brand.logo ? 'Change' : 'Upload'} logo</button>
                {brand.logo && <button onClick={() => put({ logo: '' }, 'Logo removed')} disabled={busy}>Remove</button>}
              </div>
              <small className="hint">Any size or shape works: it is scaled to fit.</small>
            </div>
          </div>
          {brand.logo && (
            <div style={{ marginTop: 10 }}>
              <b style={{ fontWeight: 600 }}>Logo size in footer</b>
              <div className="row">
                <input type="range" min={12} max={60} value={size} onChange={e => setSize(+e.target.value)} aria-label="Logo size in footer" />
                <span className="tag" style={{ minWidth: 66, textAlign: 'center' }}>{size}px</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="fl" htmlFor="brand-text">Footer text</label>
          <div className="row">
            <input id="brand-text" maxLength={120} value={text} placeholder="Leave empty to show only the logo" onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && changed) put({ text, logoSize: size }, 'Footer saved'); }} />
            {text !== DEFAULT_TEXT && <button style={{ marginBottom: 6, whiteSpace: 'nowrap' }} onClick={() => setText(DEFAULT_TEXT)}>Use default</button>}
          </div>
          <small className="hint">e.g. “Powered by Shaggar BPO Enterprise”. Leave it empty to hide the text.</small>
        </div>
      </div>

      <label className="fl" style={{ marginTop: 6 }}>Preview</label>
      <div className="brand-prev"><BrandLine text={text.trim()} logo={brand.logo} size={size} /></div>

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        {changed && <button onClick={() => { setText(brand.text); setSize(brand.logoSize); }} disabled={busy}>Cancel</button>}
        <button className="pri" disabled={!changed || busy} onClick={() => put({ text, logoSize: size }, 'Footer saved')}>Save footer</button>
      </div>
    </div>
  );
}
