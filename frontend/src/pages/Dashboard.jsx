// Accounts list: totals, search, create / delete, and the company footer logo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { PUBLIC_HOST, asset, nfcUrl } from '../config.js';
import { Icon } from '../icons.jsx';
import { Dialog, useConfirm } from '../components/Dialog.jsx';
import { useToast } from '../components/Toast.jsx';
import { ago, slugify, toData } from '../utils.js';
import { copyText } from '../clipboard.js';

function NewAccount({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [touched, setTouched] = useState(false);

  async function submit() {
    const n = name.trim(), s = slugify(slug);
    if (!n) throw new Error('Please enter a name.');
    if (s && s.length < 2) throw new Error('The page address needs at least 2 characters.');
    onCreated(await api('/api/accounts', { method: 'POST', body: { name: n, slug: s || undefined } }));
  }

  return (
    <Dialog title="Create a new account" text="One account per person. You can change everything else later." confirm="Create account" onSubmit={submit} onCancel={onClose}>
      <div className="fld">
        <label htmlFor="na-name">Full name</label>
        <input id="na-name" maxLength={80} placeholder="e.g. Yiha Yimam" autoComplete="off" value={name}
          onChange={e => { setName(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} />
      </div>
      <div className="fld">
        <label htmlFor="na-slug">Page address</label>
        <div className="dlg-url">
          <span>{PUBLIC_HOST}/</span>
          <input id="na-slug" maxLength={40} placeholder="yiha-yimam" autoComplete="off" spellCheck={false} value={slug}
            onChange={e => { setSlug(e.target.value); setTouched(!!e.target.value); }} onBlur={() => setSlug(s => slugify(s))} />
        </div>
        <small className="dlg-hint">Filled in from the name. Don’t change it after programming the NFC card.</small>
      </div>
    </Dialog>
  );
}

export default function Dashboard({ onLogout }) {
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);   // { list, brand }
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [list, brand] = await Promise.all([api('/api/accounts'), api('/api/brand')]);
      setData({ list, brand: brand.logo || '' }); setError(null);
    } catch (e) { if (e.status !== 401) setError(e); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function remove(a) {
    const ok = await confirm({ title: `Delete ${a.name || 'this account'}?`, text: 'This removes the page and all its stats. The NFC link on the card will stop working.', confirm: 'Delete account' });
    if (!ok) return;
    try { await api('/api/accounts/' + a.id, { method: 'DELETE' }); toast('Account deleted'); load(); }
    catch (e) { toast(e.message, { error: true }); }
  }

  async function setBrand(logo) {
    try { await api('/api/brand', { method: 'PUT', body: { logo } }); load(); }
    catch (e) { toast(e.message, { error: true }); }
  }

  async function uploadBrand(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) setBrand(await toData(file, 240, 'image/png').catch(() => ''));
  }

  if (error) return <div className="boot"><div><b>Could not load accounts.</b><p>{error.message}</p><button className="pri" onClick={load}>Try again</button></div></div>;
  if (!data) return <div className="boot" role="status">Loading…</div>;

  const { list, brand } = data;
  const T = list.reduce((s, x) => ({ t: s.t + x.taps, v: s.v + x.views, c: s.c + x.clicks }), { t: 0, v: 0, c: 0 });
  const f = q.toLowerCase();
  const shown = list.filter(a => (a.name + a.slug + a.title + a.company).toLowerCase().includes(f));
  const open = id => nav('/accounts/' + id);

  return (
    <>
      <header className="top">
        <span className="logo"><i className={brand ? 'has' : ''}>{brand ? <img src={asset(brand)} alt="" /> : 'S'}</i>SBPO Link Tree</span>
        <span className="sp" />
        <button className="pri" onClick={() => setCreating(true)}>+ New account</button>
        <button onClick={onLogout}>Log out</button>
      </header>
      <main>
        <div className="hero"><h1>NFC business cards</h1><p>One account per person. Copy the NFC link, write it to the card, and watch the taps come in.</p></div>
        <div className="stats">
          <div className="st"><small>Accounts</small><div>{list.length}</div></div>
          <div className="st"><small>NFC taps</small><div>{T.t}</div></div>
          <div className="st"><small>Page views</small><div>{T.v}</div></div>
          <div className="st"><small>Link clicks</small><div>{T.c}</div></div>
        </div>

        <input type="search" placeholder="Search accounts…" aria-label="Search accounts" style={{ marginBottom: 12 }} value={q} onChange={e => setQ(e.target.value)} />
        {shown.map(a => (
          <div className="acc" key={a.id} tabIndex={0} role="link" aria-label={`Edit ${a.name || 'account'}`}
            onClick={() => open(a.id)} onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) open(a.id); }}>
            {a.photo ? <img className="av" src={asset(a.photo)} alt="" /> : <div className="av">{(a.name || '?')[0].toUpperCase()}</div>}
            <div className="ai">
              <b>{a.name || '(no name)'}</b>
              <small>{[a.title, a.company].filter(Boolean).join(' · ') || 'No title yet'}</small><br />
              <small>/{a.slug} · last tap {ago(a.last)}</small>
            </div>
            <div className="nums">
              <div><b>{a.taps}</b><small>NFC taps</small></div>
              <div><b>{a.views}</b><small>Views</small></div>
              <div><b>{a.clicks}</b><small>Clicks</small></div>
            </div>
            <button onClick={e => { e.stopPropagation(); copyText(nfcUrl(a.slug)).then(ok => toast(ok ? 'NFC link copied' : nfcUrl(a.slug), { error: !ok, ms: ok ? 2600 : 6000 })); }}>Copy NFC link</button>
            <button title="Delete" aria-label={`Delete ${a.name}`} onClick={e => { e.stopPropagation(); remove(a); }}><Icon name="trash" size={16} /></button>
          </div>
        ))}
        {!shown.length && <p style={{ color: 'var(--mut)' }}>{f ? 'No accounts match your search.' : 'No accounts yet. Click “+ New account”.'}</p>}

        <div className="card">
          <h2>Footer logo</h2>
          <div className="row">
            <div className="bl">{brand ? <img src={asset(brand)} alt="" /> : <small style={{ color: 'var(--mut)' }}>No logo</small>}</div>
            <div style={{ flex: 1 }}>
              <small className="hint">Shows next to “Powered by Shaggar BPO Enterprise” at the bottom of every page, and in this header.</small>
              <button onClick={() => fileRef.current.click()}><Icon name="upload" size={14} /> Upload logo</button>
              {brand && <> <button onClick={() => setBrand('')}>Remove</button></>}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadBrand} />
            </div>
          </div>
        </div>
      </main>
      <div className="ft">Powered by Shaggar BPO Enterprise{brand && <img src={asset(brand)} alt="" />}</div>

      {creating && <NewAccount onClose={() => setCreating(false)} onCreated={a => {
        setCreating(false);
        toast(a.slug === slugify(a.profile.name) ? 'Account created' : `Account created at /${a.slug}`);
        open(a.id);
      }} />}
    </>
  );
}
