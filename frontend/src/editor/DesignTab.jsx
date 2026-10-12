// "Design" tab: theme presets, header layout, background, colors, fonts, text styles, block style.
import { PRE, FP, BS, THEMES, mkT, TXK } from '../lib/constants.js';
import { Icon } from '../components/Icon.jsx';
import { useEd, Seg, Slider, Switch, Color, FontSelect, Tabs } from './fields.jsx';

const Card = ({ title, children }) => <div className="card"><h2>{title}</h2>{children}</div>;
const COLOR_ROWS = [
  ['Page', [['Background', 'pageBg'], ['Header text and icons', 'headText']]],
  ['Link block', [['Background', 'linkBg'], ['Text', 'linkText'], ['Shadow / outline', 'linkShadow']]],
  ['Block', [['Background', 'blockBg'], ['Text', 'blockText']]],
];

export function DesignTab({ thTab, setThTab, bsTab, setBsTab }) {
  const { cur, update, upload } = useEd();
  const t = cur.theme, tx = t.tx || {};
  const theme = fn => update(d => fn(d.theme));

  const colorPreset = Object.keys(PRE).find(k => Object.keys(PRE[k]).every(x => PRE[k][x] == t[x])) || 'Custom';
  const fontPreset = Object.keys(FP).find(k => FP[k][0] === t.disp && FP[k][1] === t.body) || 'Custom';

  return <>
    <Card title="Theme">
      <Tabs value={thTab} options={Object.keys(THEMES)} onPick={setThTab} />
      <div className="tcs">
        {THEMES[thTab].map((x, i) => {
          const m = mkT(x);
          const bar = { background: m.linkBg, border: `2px solid ${m.outline ? m.linkShadow : m.linkBg}`, borderRadius: Math.min(m.radius, 12) };
          return (
            <button key={x[0]} className="tc" style={{ background: m.bgType === 'gradient' ? `linear-gradient(160deg,${m.pageBg},${m.bg2})` : m.pageBg }} onClick={() => theme(th => Object.assign(th, mkT(x)))}>
              <u style={{ borderRadius: t.picShape === 'circle' ? '50%' : 8 }} />
              <b style={{ color: m.headText, fontFamily: `'${m.disp}',serif` }}>{x[0]}</b>
              <s style={bar} /><s style={bar} /><s style={bar} />
            </button>
          );
        })}
      </div>
      <small style={{ color: 'var(--mut)' }}>Picking a theme sets colors, fonts and block style. Fine-tune everything below.</small>
    </Card>

    <Card title="Header">
      <Seg path="theme.layout" options={[['minimal', 'Minimal'], ['banner', 'Banner'], ['portrait', 'Portrait']]} />
      <h2 style={{ margin: '14px 0 8px' }}>Profile picture shape</h2>
      <Seg path="theme.picShape" options={[['rounded', 'Rounded'], ['circle', 'Circular']]} />
      <Slider label="Profile picture size" path="theme.picSize" min={60} max={420} unit="px" gap={10} />
      <Switch label="Profile picture outline" path="theme.picOutline" />
    </Card>

    <Card title="Background">
      <Seg path="theme.bgType" options={[['solid', 'Solid'], ['gradient', 'Gradient'], ['image', 'Image']]} />
      {t.bgType === 'gradient' ? <>
        <Color label="Start color" path="theme.pageBg" />
        <Color label="End color" path="theme.bg2" />
      </> : t.bgType === 'image' ? (
        <div className="row">
          <button onClick={() => upload('bg')}><Icon k="upload" size={14} /> {t.bgImage ? 'Change' : 'Upload'} image</button>
          {t.bgImage && <button onClick={() => theme(th => { th.bgImage = ''; })}>Remove</button>}
        </div>
      ) : <small style={{ color: 'var(--mut)' }}>Uses the page background color below.</small>}
    </Card>

    <Card title="Colors">
      <Tabs value={colorPreset} options={[...Object.keys(PRE), 'Custom']} onPick={k => k !== 'Custom' && theme(th => Object.assign(th, PRE[k]))} />
      {COLOR_ROWS.map(([h, rows]) => (
        <div key={h}>
          <h2 style={{ marginTop: 12 }}>{h}</h2>
          {rows.map(([l, k]) => <Color key={k} label={l} path={'theme.' + k} />)}
        </div>
      ))}
    </Card>

    <Card title="Fonts">
      <Tabs value={fontPreset} options={[...Object.keys(FP), 'Custom']} onPick={k => FP[k] && theme(th => { [th.disp, th.body] = FP[k]; })} />
      <div className="grid2">
        <label className="f">Display font<FontSelect path="theme.disp" /></label>
        <label className="f">Header text size<Seg path="theme.headSize" options={[['small', 'S'], ['medium', 'M'], ['large', 'L']]} /></label>
      </div>
      <label className="f">Body font<FontSelect path="theme.body" /></label>
    </Card>

    <Card title="Text styles">
      <small style={{ color: 'var(--mut)' }}>Pick a font and size for each piece of text. Reset puts it back to the theme default.</small>
      {TXK.map(([k, label, def]) => (
        <div key={k} style={{ margin: '12px 0 4px', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b style={{ fontWeight: 600 }}>{label}</b>
            <button style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => theme(th => { th.tx = th.tx || {}; th.tx[k] = { f: '', s: 0 }; })}>Reset</button>
          </div>
          <FontSelect path={`theme.tx.${k}.f`} empty="Theme default" />
          <Slider label="Size" path={`theme.tx.${k}.s`} min={8} max={72} value={tx[k]?.s || def} unit="px" gap={10} />
        </div>
      ))}
    </Card>

    <Card title="Block style">
      <Tabs value={bsTab} options={['Popular', 'Custom']} onPick={setBsTab} />
      {bsTab === 'Popular' ? (
        <div className="bss">
          {Object.entries(BS).map(([k, v]) => (
            <button key={k} className="bsb" onClick={() => theme(th => Object.assign(th, v))}>
              <span style={{
                display: 'block', height: 30, marginBottom: 6,
                background: `color-mix(in srgb,${t.linkBg} ${100 - v.alpha}%,transparent)`,
                borderRadius: Math.min(v.radius, 14),
                border: `2px solid ${v.outline ? t.linkShadow : 'transparent'}`,
                boxShadow: v.shadow ? '0 5px 12px rgba(0,0,0,.4)' : 'none',
              }} />
              {k}
            </button>
          ))}
        </div>
      ) : <>
        <Slider label="Corner radius" path="theme.radius" min={0} max={40} unit="px" gap={10} />
        <Slider label="Block transparency" path="theme.alpha" min={0} max={100} unit="%" gap={10} />
        <Switch label="Block shadow" path="theme.shadow" />
        <Switch label="Block outline" path="theme.outline" />
      </>}
    </Card>

    <Card title="Link style">
      <Seg path="theme.align" options={[['center', 'Classic (centered)'], ['left', 'Left aligned']]} />
    </Card>
  </>;
}

