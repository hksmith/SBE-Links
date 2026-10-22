// Companies (admins): every company with the totals of its page and all its cards. Refreshes by itself.
import { useCallback, useEffect, useState } from 'react';
import { getJson } from '../lib/api.js';
import { ago } from '../lib/utils.js';
import { navigate } from '../lib/router.js';
import { useLive } from '../lib/live.js';
import { Icon } from '../components/Icon.jsx';
import { PageHeader } from '../components/TopBar.jsx';
import { newCompany } from './companyActions.jsx';

export function Companies() {
  const [cos, setCos] = useState(null);
  const [q, setQ] = useState('');
  const load = useCallback(async () => setCos(await getJson('/api/companies')), []);
  useEffect(() => { load().catch(() => setCos([])); }, [load]);
  const updated = useLive(load);

  const head = <PageHeader title="Companies" sub="One shared design and logo for all of a company’s cards, a company page, and Excel import." live={cos ? updated : undefined}>
    <button className="pri" onClick={newCompany}>+ New company</button>
  </PageHeader>;
  if (!cos) return head;

  const f = q.toLowerCase();
  const shown = cos.filter(c => (c.name + c.slug).toLowerCase().includes(f));
  const T = cos.reduce((a, x) => ({ m: a.m + x.members, t: a.t + x.taps, v: a.v + x.views, c: a.c + x.clicks }), { m: 0, t: 0, v: 0, c: 0 });

  return <>
    {head}
    <main>
      <div className="stats">
        <div className="st"><small>Companies</small><div>{cos.length}</div></div>
        <div className="st"><small>Their cards</small><div>{T.m}</div></div>
        <div className="st"><small>Page views</small><div>{T.v}</div></div>
        <div className="st"><small>Link clicks</small><div>{T.c}</div></div>
      </div>
      {cos.length > 3 && <input placeholder="Search companies…" style={{ marginBottom: 12 }} value={q} onChange={e => setQ(e.target.value)} />}
      {shown.map(c => (
        <div key={c.id} className="acc co" onClick={() => navigate('/company/' + c.id)}>
          {c.logo ? <img className="av logo" src={c.logo} alt="" /> : <div className="av"><Icon k="building" size={20} /></div>}
          <div className="ai">
            <b>{c.name}</b>
            <small>{c.members} card{c.members === 1 ? '' : 's'}</small><br />
            <small>/{c.slug} · last tap {ago(c.last)}</small>
          </div>
          <div className="nums">
            <div><b>{c.taps}</b><small>NFC taps</small></div>
            <div><b>{c.views}</b><small>Views</small></div>
            <div><b>{c.clicks}</b><small>Clicks</small></div>
          </div>
          <span className="vw"><Icon k="graph" size={15} /> Open</span>
        </div>
      ))}
      {!shown.length && <p style={{ color: 'var(--mut)' }}>{f ? 'No companies match your search.' : 'No companies yet. Click “+ New company”.'}</p>}
    </main>
  </>;
}
