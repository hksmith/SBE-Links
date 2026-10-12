// The "Header" card of the editor. What it shows depends on what is being edited:
//   individual card   photo, name, title, department, company, bio, company logo, page address
//   company card      the same, but the logo comes from the company (locked) + the person's details
//   company page      company name, tagline, about, logo (used on every card), company details, page address
//   card design       sample person for the preview, defaults for new cards, sample details
import { O } from '../lib/utils.js';
import { Icon } from '../components/Icon.jsx';
import { CopyButton } from '../components/CopyButton.jsx';
import { useState } from 'react';
import { Dialog, showDialog } from '../components/Dialog.jsx';
import { useEd, Text, Area, Slider } from './fields.jsx';

const DETAILS = [['phone', 'Phone'], ['email', 'Email'], ['whatsapp', 'WhatsApp'], ['website', 'Website'], ['linkedin', 'LinkedIn'], ['address', 'Address']];

export function HeaderEditor() {
  const { cur } = useEd();
  if (cur.kind === 'page') return <CompanyPageHeader />;
  if (cur.kind === 'template') return <TemplateHeader />;
  return <CardHeader />;
}

function Photo({ label = 'photo' }) {
  const { cur, update, upload } = useEd();
  const p = cur.profile;
  return (
    <div className="row" style={{ marginBottom: 8 }}>
      {p.photo && <img className="th" src={p.photo} alt="" />}
      <button onClick={() => upload('photo')}><Icon k="upload" size={14} /> {p.photo ? 'Change' : 'Upload'} {label}</button>
      {p.photo && <button onClick={() => update(d => { d.profile.photo = ''; })}>Remove</button>}
    </div>
  );
}

// Logo upload with size & crop (individual cards and the company page).
function LogoControls({ label, hint }) {
  const { cur, update, upload } = useEd();
  const p = cur.profile;
  return <>
    <div className="row" style={{ marginBottom: 4 }}>
      {p.logo && <img className="th" src={p.logo} alt="" style={{ objectFit: 'contain', background: '#fff' }} />}
      <button onClick={() => upload('logo')}><Icon k="upload" size={14} /> {p.logo ? 'Change' : 'Upload'} {label}</button>
      {p.logo && <button onClick={() => update(d => { d.profile.logo = ''; })}>Remove</button>}
    </div>
    <small className="hint">{hint}</small>
    {p.logo && (
      <div className="lgc">
        <h2 style={{ margin: '10px 0 0' }}>Logo size &amp; crop {cur.kind === 'page' && <small style={{ fontWeight: 400, color: 'var(--mut)' }}>(the corner logo on the cards)</small>}</h2>
        <Slider label="Size (% of page width)" path="profile.logoSize" min={10} max={45} value={Math.min(p.logoSize ?? 30, 45)} unit="%" />
        <Slider label="Crop height (%)" path="profile.logoH" min={15} max={150} value={p.logoH ?? 40} unit="%" />
        <Slider label="Zoom (%)" path="profile.logoZoom" min={50} max={300} value={p.logoZoom ?? 100} unit="%" />
        <Slider label="Move left / right" path="profile.logoX" min={-50} max={50} value={p.logoX ?? 0} unit="%" />
        <Slider label="Move up / down" path="profile.logoY" min={-50} max={50} value={p.logoY ?? 0} unit="%" />
        <button onClick={() => update(d => Object.assign(d.profile, { logoSize: 30, logoZoom: 100, logoX: 0, logoY: 0 }))}>Reset logo</button>
      </div>
    )}
  </>;
}

// The company logo on a company card or the card design: shown, not changeable here.
function LockedLogo() {
  const { cur } = useEd();
  const p = cur.profile, co = cur.companyInfo;
  return (
    <div className="locked">
      {p.logo ? <img className="th" src={p.logo} alt="" style={{ objectFit: 'contain', background: '#fff' }} /> : <span className="chip"><Icon k="building" /></span>}
      <span><b>{co ? co.name : 'Company'} logo</b><small>{p.logo ? 'Set by the company — the same on every card of the company.' : 'No logo yet: add it on the company page.'} Change it on the company page.</small></span>
    </div>
  );
}

// Details used by {placeholders} in links and by the automatic “Save contact” card: { phone, email, … }
export function DetailsEditor({ title, hint }) {
  const { cur, set, update } = useEd();
  const f = cur.fields || {};
  const extra = Object.keys(f).filter(k => !DETAILS.some(([d]) => d === k));
  const add = async () => {
    const k = await showDialog(close => <NewDetailDialog taken={f} onClose={close} />);
    if (k) update(d => { d.fields = { ...(d.fields || {}), [k]: '' }; });
  };
  return (
    <div className="details">
      <h2>{title}</h2>
      {hint && <small className="hint" style={{ marginTop: 0 }}>{hint}</small>}
      <div className="grid2">
        {[...DETAILS, ...extra.map(k => [k, k])].map(([k, l]) => (
          <label key={k} className="f">{l} <code>{`{${k}}`}</code>
            <input value={f[k] ?? ''} onChange={e => set('fields.' + k, e.target.value)} placeholder={l} />
          </label>
        ))}
      </div>
      <button style={{ marginTop: 6 }} onClick={add}>+ Another detail</button>
    </div>
  );
}

function Address({ prefix }) {
  const { cur } = useEd();
  const path = cur.path || cur.slug, nfc = `${O}/n/${path}`;
  return <>
    <small style={{ color: 'var(--mut)' }}>Page address (don’t change after programming the NFC card)</small>
    {prefix ? <div className="dlg-url"><span>{prefix}</span><Text path="slug" placeholder="page-address" /></div> : <Text path="slug" placeholder="page-address" />}
    <small style={{ color: 'var(--mut)' }}>NFC card URL</small>
    <div className="row"><input readOnly value={nfc} /><CopyButton text={nfc} /></div>
  </>;
}

function CardHeader() {
  const { cur } = useEd();
  const co = cur.companyInfo;
  return <>
    <Photo />
    <Text path="profile.name" placeholder="Full name" />
    <Text path="profile.title" placeholder="Job title (e.g. Manager)" />
    <Text path="profile.department" placeholder="Department" />
    <Text path="profile.company" placeholder="Company name" />
    <Area path="profile.bio" placeholder="Short bio (optional)" />
    {co ? <>
      <LockedLogo />
      <DetailsEditor title="Contact details" hint="Used by the links of the company design ({phone}, {email}, …) and by the automatic “Save contact” card. Leave a detail empty to hide its button." />
      <Address prefix={`/${co.slug}/`} />
    </> : <>
      <LogoControls label="company logo" hint="The company logo shows in the top-right corner of the page." />
      <Address />
    </>}
  </>;
}

function CompanyPageHeader() {
  const { cur, update } = useEd();
  return <>
    <Text path="profile.name" placeholder="Company name" />
    <Text path="profile.title" placeholder="Tagline (e.g. Trading since 1990)" />
    <Area path="profile.bio" placeholder="About the company" />
    <LogoControls label="company logo" hint="Shown large in the center of this page, and in the corner of every card of the company. People’s cards can’t change it." />
    <DetailsEditor title="Company details" hint="Used by the links below ({website}, {phone}, {email}, {address}). A link whose detail is empty is hidden." />
    <label className="sw"><span>List the team on the company page</span><input type="checkbox" checked={cur.showTeam !== false} onChange={e => update(d => { d.showTeam = e.target.checked; })} /><i /></label>
    <Address />
  </>;
}

function TemplateHeader() {
  return <>
    <small className="hint" style={{ marginTop: 0 }}>
      This is the starting point for every new card of the company. Its <b>design</b> is shared: change it once and every card follows
      (cards given their own design keep theirs). Its <b>links</b> are copied to each new card, with {'{phone}'}, {'{email}'}, … filled in from that person’s details.
    </small>
    <h2>Sample person (only for this preview)</h2>
    <Photo label="sample photo" />
    <Text path="profile.name" placeholder="Sample name" />
    <Text path="profile.title" placeholder="Sample job title" />
    <h2 style={{ marginTop: 12 }}>Defaults for new cards</h2>
    <small className="hint" style={{ marginTop: 0 }}>Used when the person’s row leaves them empty.</small>
    <Text path="profile.department" placeholder="Department" />
    <Text path="profile.company" placeholder="Company name shown on the cards" />
    <Area path="profile.bio" placeholder="Short bio" />
    <LockedLogo />
    <DetailsEditor title="Sample details (only for this preview)" hint="Every card uses its own. Available in links as {phone}, {email}, {whatsapp}, {website}, {linkedin}, {address}, or any extra column of your Excel sheet." />
  </>;
}

function NewDetailDialog({ taken, onClose }) {
  const [name, setName] = useState('');
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
  return (
    <Dialog icon="plus" title="Add a detail" text="For example telegram, office or extension." confirm="Add" onClose={onClose}
      onSubmit={() => { if (!key) throw new Error('Please enter a name.'); if (key in taken || DETAILS.some(([d]) => d === key)) throw new Error('That detail already exists.'); return key; }}>
      <div className="fld"><label htmlFor="nd-name">Name</label><input id="nd-name" value={name} onChange={e => setName(e.target.value)} placeholder="telegram" autoComplete="off" />
        {key && <small className="dlg-hint">Use it in links as <code>{`{${key}}`}</code>, e.g. https://t.me/{`{${key}}`}. In Excel, a column named “{name.trim()}”.</small>}</div>
    </Dialog>
  );
}
