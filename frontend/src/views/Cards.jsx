// Cards: every NFC business card the user can see, with its numbers. Admins also copy NFC links,
// manage the owner's sign-in and delete cards here. Refreshes by itself.
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../AppContext.js';
import { getJson } from '../lib/api.js';
import { O, ago } from '../lib/utils.js';
import { navigate } from '../lib/router.js';
import { useLive } from '../lib/live.js';
import { Icon } from '../components/Icon.jsx';
import { CopyButton } from '../components/CopyButton.jsx';
import { PageHeader } from '../components/TopBar.jsx';
import { deleteAccount, newAccount } from './accountActions.jsx';
import { cardSignIn } from './loginDetails.jsx';

export function Cards() {
  const { isAdmin: admin } = useApp();
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('own'); // admins: 'own' = individual cards, 'all' = also cards of companies

  const load = useCallback(async () => setList(await getJson('/api/accounts')), []);
  useEffect(() => { load().catch(() => setList([])); }, [load]);
  const updated = useLive(load);

  const head = <PageHeader title="Cards" sub={admin ? 'Individual NFC business cards. Cards of a company are also under Companies.' : 'Taps, views and clicks of the cards you can see.'} live={list ? updated : undefined}>
    {admin && <button className="pri" onClick={newAccount}>+ New card</button>}
  </PageHeader>;
  if (!list) return head;

  const f = q.toLowerCase();
  const base = admin && scope === 'own' ? list.filter(a => !a.companyId) : list;
  const shown = base.filter(a => (a.name + a.slug + a.title + a.company).toLowerCase().includes(f));
  const T = base.reduce((a, x) => ({ t: a.t + x.taps, v: a.v + x.views, c: a.c + x.clicks }), { t: 0, v: 0, c: 0 });

  return <>
    {head}
    <main>
      <div className="stats">
        <div className="st"><small>Cards</small><div>{base.length}</div></div>
        <div className="st"><small>NFC taps</small><div>{T.t}</div></div>
        <div className="st"><small>Page views</small><div>{T.v}</div></div>
        <div className="st"><small>Link clicks</small><div>{T.c}</div></div>
      </div>
      <div className="qr-filter">
        <input placeholder="Search cards…" value={q} onChange={e => setQ(e.target.value)} />
        {admin && <div className="seg">
          <button className={scope === 'own' ? 'on' : ''} onClick={() => setScope('own')}>Individual</button>
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All, with companies</button>
        </div>}
      </div>
      {shown.map(a => (
        <div key={a.id} className="acc" onClick={() => navigate((admin ? '/edit/' : '/stats/') + a.id)}>
          {a.photo ? <img className="av" src={a.photo} alt="" /> : <div className="av">{(a.name || '?')[0].toUpperCase()}</div>}
          <div className="ai">
            <b>{a.name || '(no name)'}</b>
            <small>{[a.title, a.company].filter(Boolean).join(' · ') || 'No title yet'}</small><br />
            <small>/{a.path || a.slug} · last tap {ago(a.last)}</small>
          </div>
          <div className="nums">
            <div><b>{a.taps}</b><small>NFC taps</small></div>
            <div><b>{a.views}</b><small>Views</small></div>
            <div><b>{a.clicks}</b><small>Clicks</small></div>
          </div>
          {admin
            ? <>
              <CopyButton text={`${O}/n/${a.path || a.slug}`}>Copy NFC link</CopyButton>
              {'login' in a && <button className={'signin' + (a.login && a.login.mustChange ? ' new' : '')}
                title={!a.login ? 'Create a view-only sign-in for the card owner' : a.login.mustChange ? 'Not signed in yet: show the sign-in details' : 'Signed in with their own password'}
                onClick={async e => { e.stopPropagation(); if (await cardSignIn(a)) load(); }}>
                <Icon k="people" size={14} /> {!a.login ? 'Create sign-in' : a.login.mustChange ? 'Sign-in details' : 'Signed in ✓'}
              </button>}
              <button title="Delete" onClick={async e => { e.stopPropagation(); if (await deleteAccount(a)) load(); }}><Icon k="trash" size={16} /></button>
            </>
            : <span className="vw"><Icon k="graph" size={15} /> View stats</span>}
        </div>
      ))}
      {!shown.length && <p style={{ color: 'var(--mut)' }}>{f ? 'No cards match your search.' : admin ? 'No cards yet. Click “+ New card”.' : 'You don’t have access to any cards yet. Ask an admin.'}</p>}
    </main>
  </>;
}
