// Dashboard: totals, account list, footer/brand logo.
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../AppContext.js';
import { getJson } from '../lib/api.js';
import { O, ago } from '../lib/utils.js';
import { navigate } from '../lib/router.js';
import { Icon } from '../components/Icon.jsx';
import { CopyButton } from '../components/CopyButton.jsx';
import { TopBar, Footer } from '../components/TopBar.jsx';
import { deleteAccount } from './accountActions.jsx';
import { BrandingCard } from './BrandingCard.jsx';

export function Dashboard() {
  const { isAdmin: admin, setBrand } = useApp();
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const [l, b] = await Promise.all([getJson('/api/accounts'), getJson('/api/brand')]);
    setList(l); setBrand(b);
  }, [setBrand]);
  useEffect(() => { load().catch(() => setList([])); }, [load]);

  if (!list) return <TopBar />;

  const T = list.reduce((a, x) => ({ t: a.t + x.taps, v: a.v + x.views, c: a.c + x.clicks }), { t: 0, v: 0, c: 0 });
  const f = q.toLowerCase();
  const shown = list.filter(a => (a.name + a.slug + a.title + a.company).toLowerCase().includes(f));

  return <>
    <TopBar />
    <main>
      <div className="hero">{admin
        ? <><h1>NFC business cards</h1><p>One account per person. Copy the NFC link, write it to the card, and watch the taps come in.</p></>
        : <><h1>Card statistics</h1><p>Taps, views and clicks for the cards you have access to. Click a card to see its details.</p></>}
      </div>
      <div className="stats">
        <div className="st"><small>Accounts</small><div>{list.length}</div></div>
        <div className="st"><small>NFC taps</small><div>{T.t}</div></div>
        <div className="st"><small>Page views</small><div>{T.v}</div></div>
        <div className="st"><small>Link clicks</small><div>{T.c}</div></div>
      </div>
      <input placeholder="Search accounts…" style={{ marginBottom: 12 }} value={q} onChange={e => setQ(e.target.value)} />
      <div>
        {shown.map(a => (
          <div key={a.id} className="acc" onClick={() => navigate((admin ? '/edit/' : '/stats/') + a.id)}>
            {a.photo ? <img className="av" src={a.photo} alt="" /> : <div className="av">{(a.name || '?')[0].toUpperCase()}</div>}
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
            {admin
              ? <>
                <CopyButton text={`${O}/n/${a.slug}`}>Copy NFC link</CopyButton>
                <button title="Delete" onClick={async e => { e.stopPropagation(); if (await deleteAccount(a)) load(); }}><Icon k="trash" size={16} /></button>
              </>
              : <span className="vw"><Icon k="graph" size={15} /> View stats</span>}
          </div>
        ))}
        {!shown.length && <p style={{ color: 'var(--mut)' }}>{f ? 'No accounts match your search.' : admin ? 'No accounts yet. Click “+ New account”.' : 'You don’t have access to any cards yet. Ask an admin.'}</p>}
      </div>
      {admin && <BrandingCard />}
    </main>
    <Footer />
  </>;
}
