// "Design" tab: theme presets, header layout, company logo, background, colors, fonts, text styles, block and link style.
//
// Colors, Fonts and Block style each have preset tabs plus a "Custom" tab. Clicking "Custom" switches to it straight
// away, and what was set there last is kept in theme.cust, so picking a preset and coming back to Custom restores it.
import { PRE, FP, BS, THEMES, mkT, TXK, GROUP_KEYS, BG_POS } from '../lib/constants.js';
import { Icon } from '../components/Icon.jsx';
import { navigate } from '../lib/router.js';
import { cls } from '../lib/utils.js';
import { useEd, Seg, Slider, Switch, Color, FontSelect, Tabs, PosGrid } from './fields.jsx';
import { LogoControls } from './HeaderEditor.jsx';

const Card = ({ title, children }) => <div className="card"><h2>{title}</h2>{children}</div>;
const COLOR_ROWS = [
  ['Page', [['Background', 'pageBg'], ['Header text and icons', 'headText']]],
  ['Link block', [['Background', 'linkBg'], ['Text', 'linkText'], ['Shadow / outline', 'linkShadow']]],
  ['Block', [['Background', 'blockBg'], ['Text', 'blockText']]],
];
// The presets of each group as { name: { key: value } }.
const PRESETS = {
  colors: PRE,
  fonts: Object.fromEntries(Object.entries(FP).map(([k, [disp, body]]) => [k, { disp, body }])),
  block: BS,
};
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k]]));
const same = (t, preset) => Object.keys(preset).every(k => preset[k] == t[k]); // eslint-disable-line eqeqeq
const matching = (t, g) => Object.keys(PRESETS[g]).find(k => same(t, PRESETS[g][k]));

export function DesignTab({ thTab, setThTab }) {
  const { cur, update, upload } = useEd();
  const t = cur.theme, tx = t.tx || {};
  const theme = fn => update(d => fn(d.theme));
  const co = cur.companyInfo;
  const isPage = cur.kind === 'page', isTpl = cur.kind === 'template';
  // Company cards and the company page follow the company design unless given their own.
  const follows = isPage || (cur.kind === 'account' && cur.company);

  if (follows && !cur.ownDesign) return (
    <div className="card inherit">
      <h2><Icon k="building" size={15} /> Uses the {co ? co.name : 'company'} design</h2>
      <p>{isPage ? 'The company page' : 'This card'} follows the company’s shared card design, so a change to the company design shows here too.</p>
      <div className="row">
        <button className="pri" onClick={() => update(d => { d.ownDesign = true; })}>Give {isPage ? 'the company page' : 'this card'} its own design</button>
        {co && <button onClick={() => navigate(`/ctpl/${co.id}`)}>Edit the company design</button>}
      </div>
      <small className="hint">Its own design starts as a copy of the company design. You can switch back at any time.</small>
    </div>
  );

  // Which tab of a group shows as selected.
  const shown = g => (t.mode && t.mode[g] === 'Custom' ? 'Custom' : matching(t, g) || 'Custom');
  // A manual change: the group becomes "Custom" and remembers its values.
  const custom = g => d => {
    const th = d.theme;
    th.mode = { ...(th.mode || {}), [g]: 'Custom' };
    th.cust = { ...(th.cust || {}), [g]: pick(th, GROUP_KEYS[g]) };
  };
  const keepCustom = (th, g) => { if (shown(g) === 'Custom') th.cust = { ...(th.cust || {}), [g]: pick(th, GROUP_KEYS[g]) }; };
  const pickPreset = (g, name) => theme(th => { keepCustom(th, g); Object.assign(th, PRESETS[g][name]); th.mode = { ...(th.mode || {}), [g]: name }; });
  const pickCustom = g => theme(th => {
    const saved = th.cust && th.cust[g];
    if (saved && Object.keys(saved).length) Object.assign(th, saved);
    else th.cust = { ...(th.cust || {}), [g]: pick(th, GROUP_KEYS[g]) };
    th.mode = { ...(th.mode || {}), [g]: 'Custom' };
  });
  const onTab = g => k => (k === 'Custom' ? pickCustom(g) : pickPreset(g, k));

  const pageBg = t.bgType === 'gradient' ? `linear-gradient(${t.bgAngle ?? 160}deg,${t.pageBg},${t.bg2})` : t.pageBg;
  const blockTab = t.mode && t.mode.block === 'Custom' ? 'Custom' : 'Popular';
  const pic = isPage ? 'Logo' : 'Profile picture';

  return <>
    {follows && <div className="note row" style={{ justifyContent: 'space-between' }}>
      <span>{isPage ? 'The company page' : 'This card'} has its <b>own design</b>; changes to the company design don’t reach it.</span>
      <button onClick={() => update(d => { d.ownDesign = false; })}>Use the company design again</button>
    </div>}
    {isTpl && <div className="note">
      This design is shared by every card of {co ? co.name : 'the company'} and by the company page (except those given their own design). Changes apply to all of them.
    </div>}

    <Card title="Theme">
      <Tabs value={thTab} options={Object.keys(THEMES)} onPick={setThTab} />
      <div className="tcs">
        {THEMES[thTab].map(x => {
          const m = mkT(x);
          const bar = { background: m.linkBg, border: `2px solid ${m.outline ? m.linkShadow : m.linkBg}`, borderRadius: Math.min(m.radius, 12) };
          return (
            <button key={x[0]} className="tc" style={{ background: m.bgType === 'gradient' ? `linear-gradient(160deg,${m.pageBg},${m.bg2})` : m.pageBg }}
              onClick={() => theme(th => { Object.assign(th, mkT(x)); th.mode = {}; })}>
              <u style={{ borderRadius: t.picShape === 'circle' ? '50%' : t.picShape === 'square' ? 0 : 8 }} />
              <b style={{ color: m.headText, fontFamily: `'${m.disp}',serif` }}>{x[0]}</b>
              <s style={bar} /><s style={bar} /><s style={bar} />
            </button>
          );
        })}
      </div>
      <small style={{ color: 'var(--mut)' }}>Picking a theme sets colors, fonts and block style. Fine-tune everything below.</small>
    </Card>

    <Card title="Header">
      {!isPage && <Seg path="theme.layout" options={[['minimal', 'Minimal'], ['banner', 'Banner'], ['portrait', 'Portrait']]} />}
      <h2 style={{ margin: '14px 0 8px' }}>{pic} shape</h2>
      <Seg path="theme.picShape" options={[['rounded', 'Rounded'], ['circle', 'Circular'], ['square', 'Square']]} />
      <Slider label={`${pic} size`} path="theme.picSize" min={60} max={420} unit="px" gap={10} />
      <Switch label={`${pic} outline`} path="theme.picOutline" />
      {t.picOutline && <>
        <Color label="Outline color" path="theme.picRing" fallback={t.headText} />
        <Slider label="Outline width" path="theme.picRingW" min={1} max={12} value={t.picRingW ?? 4} unit="px" />
      </>}
      <h2 style={{ margin: '14px 0 8px' }}>Name &amp; title alignment</h2>
      <Seg path="theme.headAlign" fallback="center" options={[['center', 'Centered'], ['left', 'Left']]} />
    </Card>

    {isTpl && <Card title="Company logo on the cards">
      <LogoControls hint="The same logo shows on the company page. Its size and position here apply to every card of the company." />
    </Card>}

    <Card title="Background">
      <Seg path="theme.bgType" options={[['solid', 'Solid'], ['gradient', 'Gradient'], ['image', 'Image']]} />
      {t.bgType === 'gradient' ? <>
        <Color label="Start color" path="theme.pageBg" after={custom('colors')} />
        <Color label="End color" path="theme.bg2" />
        <Slider label="Direction" path="theme.bgAngle" min={0} max={360} step={5} value={t.bgAngle ?? 160} unit="°" />
      </> : t.bgType === 'image' ? <>
        <div className="row">
          {t.bgImage && <img className="th" src={t.bgImage} alt="" />}
          <button onClick={() => upload('bg')}><Icon k="upload" size={14} /> {t.bgImage ? 'Change' : 'Upload'} image</button>
          {t.bgImage && <button onClick={() => theme(th => { th.bgImage = ''; })}>Remove</button>}
        </div>
        {t.bgImage && <div className="lgc">
          <h2 style={{ margin: '10px 0 8px' }}>Image size</h2>
          <Seg path="theme.bgSize" fallback="cover" options={[['cover', 'Fill the page'], ['contain', 'Show whole image'], ['zoom', 'Custom size']]} />
          {t.bgSize === 'zoom' && <Slider label="Image width (% of the page)" path="theme.bgZoom" min={20} max={300} step={5} value={t.bgZoom ?? 100} unit="%" />}
          <h2 style={{ margin: '12px 0 8px' }}>Image position</h2>
          <PosGrid path="theme.bgPos" options={BG_POS} fallback="center" />
          <Slider label="Darken the image (keeps text readable)" path="theme.bgDim" min={0} max={80} value={t.bgDim ?? 0} unit="%" />
          <Switch label="Keep the image still while scrolling" path="theme.bgFixed" value={t.bgFixed !== false} />
          <Color label="Color around the image" path="theme.pageBg" after={custom('colors')} />
        </div>}
      </> : <small style={{ color: 'var(--mut)' }}>Uses the page background color below.</small>}
    </Card>

    <Card title="Colors">
      <Tabs value={shown('colors')} options={[...Object.keys(PRE), 'Custom']} onPick={onTab('colors')} />
      {COLOR_ROWS.map(([h, rows]) => (
        <div key={h}>
          <h2 style={{ marginTop: 12 }}>{h}</h2>
          {rows.map(([l, k]) => <Color key={k} label={l} path={'theme.' + k} after={custom('colors')} />)}
        </div>
      ))}
    </Card>

    <Card title="Fonts">
      <Tabs value={shown('fonts')} options={[...Object.keys(FP), 'Custom']} onPick={onTab('fonts')} />
      <div className="grid2">
        <label className="f">Display font<FontSelect path="theme.disp" after={custom('fonts')} /></label>
        <label className="f">Header text size<Seg path="theme.headSize" options={[['small', 'S'], ['medium', 'M'], ['large', 'L']]} /></label>
      </div>
      <label className="f">Body font<FontSelect path="theme.body" after={custom('fonts')} /></label>
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
      <Tabs value={blockTab} options={['Popular', 'Custom']} onPick={k => (k === 'Custom' ? pickCustom('block') : theme(th => { keepCustom(th, 'block'); th.mode = { ...(th.mode || {}), block: 'Popular' }; }))} />
      {blockTab === 'Popular' ? (
        <div className="bss">
          {Object.entries(BS).map(([k, v]) => (
            <button key={k} className={cls('bsb', same(t, v) && 'on')} onClick={() => pickPreset('block', k)}>
              <span className="bsp" style={{ background: pageBg }}>
                <span style={{
                  background: `color-mix(in srgb,${t.linkBg} ${100 - v.alpha}%,transparent)`, color: t.linkText,
                  borderRadius: Math.min(v.radius, 14),
                  border: `2px solid ${v.outline ? t.linkShadow : 'transparent'}`,
                  boxShadow: v.shadow ? '0 5px 12px rgba(0,0,0,.4)' : 'none',
                }}>Link</span>
              </span>
              {k}
            </button>
          ))}
        </div>
      ) : <>
        <Slider label="Corner radius" path="theme.radius" min={0} max={40} unit="px" gap={10} after={custom('block')} />
        <Slider label="Block transparency" path="theme.alpha" min={0} max={100} unit="%" gap={10} after={custom('block')} />
        <Switch label="Block shadow" path="theme.shadow" after={custom('block')} />
        <Switch label="Block outline" path="theme.outline" after={custom('block')} />
      </>}
    </Card>

    <Card title="Link style">
      <Seg path="theme.align" options={[['center', 'Classic (centered)'], ['left', 'Left aligned']]} />
      <h2 style={{ margin: '12px 0 8px' }}>Icon side</h2>
      <Seg path="theme.iconPos" fallback="left" options={[['left', 'Icon on the left'], ['right', 'Icon on the right']]} />
      <h2 style={{ margin: '12px 0 8px' }}>Button size</h2>
      <Seg path="theme.btnSize" fallback="m" options={[['s', 'Compact'], ['m', 'Regular'], ['l', 'Large']]} />
      <Slider label="Space between buttons" path="theme.gap" min={4} max={30} value={t.gap ?? 12} unit="px" />
    </Card>
  </>;
}
