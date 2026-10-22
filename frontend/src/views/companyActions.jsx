// Dialogs for companies: new company, add one card, import cards from Excel, delete.
import { useRef, useState } from 'react';
import { send, api } from '../lib/api.js';
import { O, slugify, pickFiles } from '../lib/utils.js';
import { toast } from '../lib/toast.js';
import { navigate } from '../lib/router.js';
import { Icon } from '../components/Icon.jsx';
import { Dialog, showDialog, confirmDialog } from '../components/Dialog.jsx';
import { showLoginDetails } from './loginDetails.jsx';

const host = () => O.replace(/^https?:\/\//, '') + '/';

// Starts a file download of an admin-only file (the browser sends the sign-in cookie).
export function download(url) {
  const a = document.createElement('a');
  a.href = url; a.download = ''; a.hidden = true;
  document.body.appendChild(a); a.click(); a.remove();
}
export const downloadSignIns = c => download(`/api/companies/${c.id}/sign-ins.xlsx`);
export const downloadTemplate = c => download(`/api/companies/${c.id}/template.xlsx`);

const Check = ({ checked, onChange, title, text }) => (
  <div className="fld"><label className="opt"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span><b>{title}</b><small>{text}</small></span></label></div>
);

/* ---------- new company ---------- */
function NewCompanyDialog({ onClose }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [login, setLogin] = useState(true);
  const touched = useRef(false), nameRef = useRef(null);
  const submit = async () => {
    const n = name.trim(), s = slugify(slug);
    if (!n) { nameRef.current.focus(); throw new Error('Please enter the company name.'); }
    if (s && s.length < 2) throw new Error('The page address needs at least 2 characters.');
    return send('/api/companies', 'POST', { name: n, slug: s || undefined, login }, 'Could not create the company. Please try again.');
  };
  return (
    <Dialog icon="building" title="Create a company" text="A company page, one shared design and logo, and everyone’s cards under one address." confirm="Create company" onSubmit={submit} onClose={onClose}>
      <div className="fld"><label htmlFor="nc-name">Company name</label>
        <input id="nc-name" ref={nameRef} maxLength={80} placeholder="e.g. Acme Trading" autoComplete="off" value={name}
          onChange={e => { setName(e.target.value); if (!touched.current) setSlug(slugify(e.target.value)); }} /></div>
      <div className="fld"><label htmlFor="nc-slug">Page address</label>
        <div className="dlg-url"><span>{host()}</span>
          <input id="nc-slug" maxLength={40} placeholder="acme" autoComplete="off" spellCheck={false} value={slug}
            onChange={e => { setSlug(e.target.value); touched.current = !!e.target.value; }} onBlur={() => setSlug(s => slugify(s))} /></div>
        <small className="dlg-hint">The company page. Cards will be at {host()}{slugify(slug) || 'acme'}/person-name. Don’t change it after programming NFC cards.</small></div>
      <Check checked={login} onChange={setLogin} title="Create a company admin sign-in"
        text="A view-only sign-in for the company: totals of all its cards and each person’s statistics. First-time password, changed at first sign-in." />
    </Dialog>
  );
}

export async function newCompany() {
  const c = await showDialog(close => <NewCompanyDialog onClose={close} />);
  if (!c) return;
  toast('Company created');
  navigate('/company/' + c.id);
  if (c.login) showLoginDetails('Company admin sign-in', 'Send this to the company. Next: set the logo on the company page and the card design, then add the people.', [{ name: c.name, company: c.name, ...c.login }]);
}

/* ---------- one card ---------- */
const PERSON = [['title', 'Job title', 'e.g. Sales Manager'], ['department', 'Department', 'Leave empty for the default'], ['phone', 'Phone', '+251 911 223344'], ['email', 'Email', 'name@company.com'], ['whatsapp', 'WhatsApp', '+251 911 223344'], ['linkedin', 'LinkedIn', 'https://linkedin.com/in/…']];

function AddMemberDialog({ company: c, onClose }) {
  const [v, setV] = useState({});
  const [slug, setSlug] = useState('');
  const [login, setLogin] = useState(true);
  const touched = useRef(false), nameRef = useRef(null);
  const put = (k, x) => setV(o => ({ ...o, [k]: x }));
  const submit = async () => {
    const name = (v.name || '').trim(), s = slugify(slug);
    if (!name) { nameRef.current.focus(); throw new Error('Please enter the full name.'); }
    if (s && s.length < 2) throw new Error('The page address needs at least 2 characters.');
    const { title, department, ...fields } = v;
    delete fields.name;
    return send(`/api/companies/${c.id}/members`, 'POST', { name, title, department, fields, slug: s || undefined, login }, 'Could not create the card. Please try again.');
  };
  return (
    <Dialog icon="profile" title={`Add a card to ${c.name}`} text="Only this person’s details: the design, logo and links come from the company card design." confirm="Create card" onSubmit={submit} onClose={onClose}>
      <div className="fld"><label htmlFor="am-name">Full name</label>
        <input id="am-name" ref={nameRef} maxLength={80} autoComplete="off" placeholder="e.g. Abebe Kebede" value={v.name || ''}
          onChange={e => { put('name', e.target.value); if (!touched.current) setSlug(slugify(e.target.value)); }} /></div>
      <div className="grid2">
        {PERSON.map(([k, l, ph]) => (
          <div key={k} className="fld"><label htmlFor={'am-' + k}>{l}</label><input id={'am-' + k} autoComplete="off" placeholder={ph} value={v[k] || ''} onChange={e => put(k, e.target.value)} /></div>
        ))}
      </div>
      <div className="fld"><label htmlFor="am-slug">Page address</label>
        <div className="dlg-url"><span>{host()}{c.slug}/</span>
          <input id="am-slug" maxLength={40} autoComplete="off" spellCheck={false} value={slug}
            onChange={e => { setSlug(e.target.value); touched.current = !!e.target.value; }} onBlur={() => setSlug(s => slugify(s))} /></div></div>
      <Check checked={login} onChange={setLogin} title="Let them see their own statistics" text="Creates a view-only sign-in with the first-time password." />
    </Dialog>
  );
}

export async function addMember(c) {
  const a = await showDialog(close => <AddMemberDialog company={c} onClose={close} />);
  if (!a) return false;
  toast(`Card created at /${a.path}`);
  if (a.login) showLoginDetails('Their sign-in details', 'Send this to the person so they can see their statistics.', [{ name: a.profile.name, ...a.login }]);
  return true;
}

/* ---------- import from Excel ---------- */
const readBase64 = file => new Promise((res, rej) => { const r = new FileReader(); r.onerror = rej; r.onload = () => res(String(r.result)); r.readAsDataURL(file); });

function ImportDialog({ company: c, onClose }) {
  const [file, setFile] = useState(null);
  const [login, setLogin] = useState(true);
  const choose = async () => { const [f] = await pickFiles({ accept: '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv' }); if (f) setFile(f); };
  const submit = async () => {
    if (!file) throw new Error('Choose the filled-in Excel file first.');
    if (/\.xls$/i.test(file.name)) throw new Error('That is an old .xls file. In Excel choose File › Save As › Excel Workbook (.xlsx), then try again.');
    if (file.size > 8e6) throw new Error('The file is larger than 8 MB.');
    return send(`/api/companies/${c.id}/import`, 'POST', { data: await readBase64(file), login }, 'Could not import the file.');
  };
  return (
    <Dialog icon="upload" title={`Import cards into ${c.name}`} text="One card per row, made from the company card design." confirm="Import" onSubmit={submit} onClose={onClose}>
      <ol className="steps">
        <li><button type="button" className="lnk" onClick={() => downloadTemplate(c)}><Icon k="download" size={13} /> Download the Excel template</button> and fill in one row per person (only the full name is required).</li>
        <li>Choose the filled-in file (.xlsx or .csv).</li>
      </ol>
      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" onClick={choose}><Icon k="file" size={14} /> {file ? 'Choose another file' : 'Choose file'}</button>
        {file && <span className="tag">{file.name}</span>}
      </div>
      <Check checked={login} onChange={setLogin} title="Create a sign-in for each person" text="View-only, first-time password. You get an Excel file with everyone’s username and password to send to the company." />
    </Dialog>
  );
}

function ImportResultDialog({ company: c, result: r, onClose }) {
  const withLogin = r.created.filter(x => x.username).length;
  return (
    <Dialog icon="people" title={`${r.created.length} card${r.created.length === 1 ? '' : 's'} created`} confirm="Done" cancel="Close" onClose={onClose}
      text={withLogin ? 'The sign-ins file has been downloaded: send it to the company so everyone gets their username and password.' : ''}>
      {withLogin > 0 && <button type="button" className="blk" onClick={() => downloadSignIns(c)}><Icon k="download" size={14} /> Download the sign-ins file again</button>}
      {r.skipped.length > 0 && <>
        <b style={{ fontSize: 13 }}>{r.skipped.length} row{r.skipped.length === 1 ? '' : 's'} skipped</b>
        <div className="skipped">{r.skipped.map(x => <div key={x.line}><span className="tag">Row {x.line}</span> {x.name ? <b>{x.name}</b> : null} {x.reason}</div>)}</div>
      </>}
    </Dialog>
  );
}

export async function importMembers(c) {
  const r = await showDialog(close => <ImportDialog company={c} onClose={close} />);
  if (!r) return false;
  if (r.created.some(x => x.username)) downloadSignIns(c);
  await showDialog(close => <ImportResultDialog company={c} result={r} onClose={close} />);
  return true;
}

export async function deleteCompany(c) {
  const ok = await confirmDialog({
    title: `Delete ${c.name}?`,
    text: `This deletes the company page and all ${c.members.length} card${c.members.length === 1 ? '' : 's'} of the company, their statistics and sign-ins. Their NFC links will stop working.`,
    confirm: 'Delete company',
  });
  if (!ok) return false;
  const r = await api('/api/companies/' + c.id, 'DELETE');
  if (!r.ok) { toast('Could not delete the company', { error: true }); return false; }
  toast('Company deleted');
  return true;
}

// The company admin's sign-in: show it, create it, or reset a forgotten password.
export async function companyAdminSignIn(c) {
  const L = c.adminLogin, item = x => [{ name: c.name, company: c.name, ...x }];
  try {
    if (!L) {
      const x = await send(`/api/companies/${c.id}/admin-login`, 'POST', undefined, 'Could not create the sign-in.');
      showLoginDetails('Company admin sign-in created', 'Send this to the company.', item(x));
      return true;
    }
    if (L.mustChange) { showLoginDetails('Company admin sign-in', 'Not signed in yet. Send this to the company.', item(L)); return false; }
    if (!(await confirmDialog({ title: 'The company has set its own password', icon: 'profile', danger: false, confirm: 'Reset password',
      text: `Username: ${L.username}. If it was forgotten, reset it to the first-time password and send a new message.` }))) return false;
    const x = await send(`/api/users/${encodeURIComponent(L.username)}/reset`, 'POST', undefined, 'Could not reset the password.');
    showLoginDetails('Password reset', 'Send this to the company.', item(x));
    return true;
  } catch (e) { toast(e.message, { error: true }); return false; }
}

// Statistics back to zero: the whole company (page + every card), only the company page, or one card.
// `c` is the company as loaded by its screen ({ id, name, page, members }). Resolves true when done.
function ResetStatsDialog({ c, card, onClose }) {
  const [scope, setScope] = useState(card ? 'card' : 'all');
  const [pick, setPick] = useState(card ? card.id : (c.members[0] || {}).id || '');
  const num = x => (x ? (x.views || 0) + (x.clicks || 0) : 0);
  const total = num(c.page) + c.members.reduce((s, m) => s + num(m), 0);
  const submit = () => {
    const body = { scope: scope === 'card' ? pick : scope };
    if (!body.scope) throw new Error('Choose a card.');
    return send(`/api/companies/${c.id}/reset-stats`, 'POST', body, 'Could not reset the statistics');
  };
  return (
    <Dialog icon="graph" danger title="Reset statistics" confirm="Reset statistics" onSubmit={submit} onClose={onClose}
      text="The chosen statistics are deleted and counting starts again from zero. Pages, cards and NFC links keep working. This can’t be undone.">
      <div className="fld">
        <label className="opt"><input type="radio" name="rs" checked={scope === 'all'} onChange={() => setScope('all')} />
          <span><b>The whole company</b><small>The company page and all {c.members.length} card{c.members.length === 1 ? '' : 's'} · views and clicks: {total}</small></span></label>
        <label className="opt"><input type="radio" name="rs" checked={scope === 'page'} onChange={() => setScope('page')} />
          <span><b>Only the company page</b><small>Views and clicks: {num(c.page)}</small></span></label>
        <label className="opt"><input type="radio" name="rs" checked={scope === 'card'} onChange={() => setScope('card')} disabled={!c.members.length} />
          <span><b>One card</b><small>{c.members.length ? 'Choose whose statistics to reset' : 'This company has no cards yet'}</small></span></label>
        {scope === 'card' && c.members.length > 0 && (
          <select value={pick} onChange={e => setPick(e.target.value)} style={{ marginTop: 2 }}>
            {c.members.map(m => <option key={m.id} value={m.id}>{m.name || '(no name)'} — views and clicks: {num(m)}</option>)}
          </select>
        )}
      </div>
    </Dialog>
  );
}

export async function resetCompanyStats(c, card) {
  const r = await showDialog(close => <ResetStatsDialog c={c} card={card} onClose={close} />);
  if (r) toast(r.pages > 1 ? `Statistics of ${r.pages} pages reset` : 'Statistics reset');
  return !!r;
}
