// "Design" tab: theme presets, header layout, background, colors, fonts, text styles, block style.
import { useState } from 'react';
import { Icon } from '../../icons.jsx';
import { BS, FONTS, FP, PRE, THEMES, TXK, mkT } from '../../constants.js';
import { Seg, Slider, Switch } from './controls.jsx';

const Card = ({ title, children }) => <div className="card"><h2>{title}</h2>{children}</div>;
const ColorRow = ({ ed, label, k }) => (
  <div className="cr"><span>{label}</span><input type="color" aria-label={label} value={ed.account.theme[k]} onChange={e => ed.set('theme.' + k, e.target.value)} /></div>
);
const Tabs = ({ value, options, onChange }) => (
  <div className="seg">{options.map(k => <button key={k} className={value === k ? 'on' : ''} aria-pressed={value === k} onClick={() => onChange(k)}>{k}</button>)}</div>
);
const FontSelect = ({ ed, path, value, label, theme }) => (
  <select aria-label={label} value={value} onChange={e => ed.set(path, e.target.value)}>
    {theme && <option value="">Theme default</option>}
    {FONTS.map(f => <option key={f}>{f}</option>)}
  </select>
);

export default function DesignTab({ ed }) {
  const { account, update } = ed;
  const t = account.theme;
  const [thTab, setThTab] = useState('Classic');
  const [bsTab, setBsTab] = useState('Popular');

  const activePreset = Object.keys(PRE).find(k => Object.keys(PRE[k]).every(x => PRE[k][x] === t[x])) || 'Custom';
  const activeFonts = Object.keys(FP).find(k => FP[k][0] === t.disp && FP[k][1] === t.body) || 'Custom';
  const apply = patch => update(a => Object.assign(a.theme, patch));

  return (
    <>
      <Card title="Theme">
        <Tabs value={thTab} options={Object.keys(THEMES)} onChange={setThTab} />
        <div className="tcs">
          {THEMES[thTab].map((x, i) => {
            const m = mkT(x);
            const bg = m.bgType === 'gradient' ? `linear-gradient(160deg,${m.pageBg},${m.bg2})` : m.pageBg;
            const bl = { background: m.linkBg, border: `2px solid ${m.outline ? m.linkShadow : m.linkBg}`, borderRadius: Math.min(m.radius, 12) };
            return (
              <button key={x[0]} className="tc" style={{ background: bg }} aria-label={`${x[0]} theme`} onClick={() => apply(m)}>
                <u style={{ borderRadius: t.picShape === 'circle' ? '50%' : 8 }} />
                <b style={{ color: m.headText, fontFamily: `'${m.disp}',serif` }}>{x[0]}</b>
                <s style={bl} /><s style={bl} /><s style={bl} />
              </button>
            );
          })}
        </div>
        <small style={{ color: 'var(--mut)' }}>Picking a theme sets colors, fonts and block style. Fine-tune everything below.</small>
      </Card>

      <Card title="Header">
        <Seg ed={ed} path="theme.layout" options={[['minimal', 'Minimal'], ['banner', 'Banner'], ['portrait', 'Portrait']]} />
        <h2 style={{ margin: '14px 0 8px' }}>Profile picture shape</h2>
        <Seg ed={ed} path="theme.picShape" options={[['rounded', 'Rounded'], ['circle', 'Circular']]} />
        <Slider ed={ed} label="Profile picture size" path="theme.picSize" min={60} max={420} unit="px" />
        <Switch ed={ed} label="Profile picture outline" path="theme.picOutline" />
      </Card>

      <Card title="Background">
        <Seg ed={ed} path="theme.bgType" options={[['solid', 'Solid'], ['gradient', 'Gradient'], ['image', 'Image']]} />
        {t.bgType === 'gradient' && <><ColorRow ed={ed} label="Start color" k="pageBg" /><ColorRow ed={ed} label="End color" k="bg2" /></>}
        {t.bgType === 'image' && (
          <div className="row">
            <button onClick={() => ed.pickFile('bg')}><Icon name="upload" size={14} /> {t.bgImage ? 'Change' : 'Upload'} image</button>
            {t.bgImage && <button onClick={() => apply({ bgImage: '' })}>Remove</button>}
          </div>
        )}
        {t.bgType === 'solid' && <small style={{ color: 'var(--mut)' }}>Uses the page background color below.</small>}
      </Card>

      <Card title="Colors">
        <Tabs value={activePreset} options={[...Object.keys(PRE), 'Custom']} onChange={k => { if (k !== 'Custom') apply(PRE[k]); }} />
        <h2 style={{ marginTop: 12 }}>Page</h2>
        <ColorRow ed={ed} label="Background" k="pageBg" /><ColorRow ed={ed} label="Header text and icons" k="headText" />
        <h2 style={{ marginTop: 12 }}>Link block</h2>
        <ColorRow ed={ed} label="Background" k="linkBg" /><ColorRow ed={ed} label="Text" k="linkText" /><ColorRow ed={ed} label="Shadow / outline" k="linkShadow" />
        <h2 style={{ marginTop: 12 }}>Block</h2>
        <ColorRow ed={ed} label="Background" k="blockBg" /><ColorRow ed={ed} label="Text" k="blockText" />
      </Card>

      <Card title="Fonts">
        <Tabs value={activeFonts} options={[...Object.keys(FP), 'Custom']} onChange={k => { if (FP[k]) apply({ disp: FP[k][0], body: FP[k][1] }); }} />
        <div className="grid2">
          <label className="f">Display font<FontSelect ed={ed} path="theme.disp" value={t.disp} label="Display font" /></label>
          <div className="f">Header text size<Seg ed={ed} path="theme.headSize" options={[['small', 'S'], ['medium', 'M'], ['large', 'L']]} /></div>
        </div>
        <label className="f">Body font<FontSelect ed={ed} path="theme.body" value={t.body} label="Body font" /></label>
      </Card>

      <Card title="Text styles">
        <small style={{ color: 'var(--mut)' }}>Pick a font and size for each piece of text. Reset puts it back to the theme default.</small>
        {TXK.map(([k, label, def]) => {
          const x = (t.tx && t.tx[k]) || { f: '', s: 0 };
          return (
            <div key={k} style={{ margin: '12px 0 4px', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b style={{ fontWeight: 600 }}>{label}</b>
                <button style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => ed.set(`theme.tx.${k}`, { f: '', s: 0 })}>Reset</button>
              </div>
              <FontSelect ed={ed} path={`theme.tx.${k}.f`} value={x.f} label={`${label} font`} theme />
              <Slider ed={ed} label="Size" path={`theme.tx.${k}.s`} min={8} max={72} value={x.s || def} unit="px" />
            </div>
          );
        })}
      </Card>

      <Card title="Block style">
        <Tabs value={bsTab} options={['Popular', 'Custom']} onChange={setBsTab} />
        {bsTab === 'Popular' ? (
          <div className="bss">
            {Object.entries(BS).map(([k, v]) => (
              <button key={k} className="bsb" onClick={() => apply(v)}>
                <span style={{ display: 'block', height: 30, marginBottom: 6, background: `color-mix(in srgb,${t.linkBg} ${100 - v.alpha}%,transparent)`, borderRadius: Math.min(v.radius, 14), border: `2px solid ${v.outline ? t.linkShadow : 'transparent'}`, boxShadow: v.shadow ? '0 5px 12px rgba(0,0,0,.4)' : 'none' }} />
                {k}
              </button>
            ))}
          </div>
        ) : (
          <>
            <Slider ed={ed} label="Corner radius" path="theme.radius" min={0} max={40} unit="px" />
            <Slider ed={ed} label="Block transparency" path="theme.alpha" min={0} max={100} unit="%" />
            <Switch ed={ed} label="Block shadow" path="theme.shadow" />
            <Switch ed={ed} label="Block outline" path="theme.outline" />
          </>
        )}
      </Card>

      <Card title="Link style">
        <Seg ed={ed} path="theme.align" options={[['center', 'Classic (centered)'], ['left', 'Left aligned']]} />
      </Card>
    </>
  );
}
