// A company: totals over all its cards, the people's cards, and combined statistics.
// Admins also manage it here (company page, card design, add / import cards, sign-ins).
// The company admin (view only) lands here after signing in.
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../AppContext.js';
import { getJson } from '../lib/api.js';
import { O, ago, cls } from '../lib/utils.js';
import { toast } from '../lib/toast.js';
import { navigate } from '../lib/router.js';
import { Icon } from '../components/Icon.jsx';
import { Menu } from '../components/Menu.jsx';
import { CopyButton } from '../components/CopyButton.jsx';
import { PageHeader } from '../components/TopBar.jsx';
import { useLive } from '../lib/live.js';
import { Chart, Table } from './Analytics.jsx';
import { deleteAccount } from './accountActions.jsx';
import { cardSignIn } from './loginDetails.jsx';
import { addMember, importMembers, downloadSignIns, downloadTemplate, deleteCompany, companyAdminSignIn, resetCompanyStats } from './companyActions.jsx';

export function CompanyView({ id }) {
  const { isAdmin: admin } = useApp();
  const [c, setC] = useState(null);
  const [tab, setTab] = useState('cards');
  const [q, setQ] = useState('');

  const load = useCallback(async () => setC(await getJson('/api/companies/' + id)), [id]);
  useEffect(() => { load().catch(() => { toast('That company was not found', { error: true }); navigate('/'); }); }, [load]);
  const updated = useLive(load);
  const back = admin ? ['/companies', 'Companies'] : null;

  if (!c) return <PageHeader title="Company" back={back} />;

  const s = c.stats, url = `${O}/${c.slug}`, f = q.toLowerCase();
  const shown = c.members.filter(a => (a.name + a.slug + a.title + a.department).toLowerCase().includes(f));
  const run = fn => async e => { e && e.stopPropagation(); if (await fn()) load(); };

  return <>
    <PageHeader title={c.name} sub={`${c.members.length} card${c.members.length === 1 ? '' : 's'}`} back={back} live={updated} />
    <main>
      <div className="co-hero">
        {c.logo ? <img className="co-logo" src={c.logo} alt="" /> : <div className="co-logo none"><Icon k="building" size={30} /></div>}
        <div className="ai">
          <h1>{c.name}</h1>
          {c.tagline && <p>{c.tagline}</p>}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className="url">{url.replace(/^https?:\/\//, '')}</span>
            <CopyButton text={url} />
            <a href={url} target="_blank" rel="noopener"><button>Open <Icon k="open" size={13} /></button></a>
            {admin && <CopyButton text={`${O}/n/${c.slug}`}>Copy NFC link</CopyButton>}
          </div>
        </div>
        {admin && <div className="co-edit">
          <button className="pri" onClick={() => navigate('/cpage/' + c.id)}><Icon k="building" size={14} /> Company page &amp; logo</button>
          <button className="pri" onClick={() => navigate('/ctpl/' + c.id)}><Icon k="card" size={14} /> Card design</button>
        </div>}
      </div>

      <div className="stats">
        <div className="st"><small>Cards</small><div>{c.members.length}</div></div>
        <div className="st"><small>NFC taps</small><div>{s.taps}</div></div>
        <div className="st"><small>Page views</small><div>{s.views}</div></div>
        <div className="st"><small>Link clicks</small><div>{s.clicks}</div></div>
      </div>

      {admin && (
        <div className="co-actions">
          <button className="blk" onClick={run(() => addMember(c))}>+ Add card</button>
          <button className="blk" onClick={run(() => importMembers(c))}><Icon k="upload" size={14} /> Import from Excel</button>
          <button onClick={() => downloadTemplate(c)}><Icon k="download" size={14} /> Excel template</button>
          <button onClick={() => downloadSignIns(c)} disabled={!c.members.length && !c.adminLogin}><Icon k="download" size={14} /> Sign-ins (Excel)</button>
          <span className="sp" />
          <button className={cls('signin', c.adminLogin && c.adminLogin.mustChange && 'new')} onClick={run(() => companyAdminSignIn(c))}
            title="The company’s view-only sign-in: totals of all cards and each person’s statistics">
            <Icon k="people" size={14} /> {!c.adminLogin ? 'Create company admin sign-in' : `Company admin: ${c.adminLogin.username}${c.adminLogin.mustChange ? ' · not signed in yet' : ' ✓'}`}
          </button>
          <Menu summary="•••" label="Company menu">
            <button onClick={run(() => resetCompanyStats(c))}>Reset statistics…</button>
            <button className="dng" onClick={async () => { if (await deleteCompany(c)) navigate('/companies'); }}>Delete company…</button>
          </Menu>
        </div>
      )}

      <div className="tabs" style={{ maxWidth: 360 }}>
        <button className={cls(tab === 'cards' && 'on')} onClick={() => setTab('cards')}>Cards</button>
        <button className={cls(tab === 'stats' && 'on')} onClick={() => setTab('stats')}>Statistics</button>
      </div>

      {tab === 'cards' ? <>
        {c.members.length > 4 && <input placeholder="Search people…" style={{ marginBottom: 12 }} value={q} onChange={e => setQ(e.target.value)} />}
        {shown.map(a => (
          <div key={a.id} className="acc" onClick={() => navigate((admin ? '/edit/' : '/stats/') + a.id)}>
            {a.photo ? <img className="av" src={a.photo} alt="" /> : <div className="av">{(a.name || '?')[0].toUpperCase()}</div>}
            <div className="ai">
              <b>{a.name || '(no name)'}</b>{a.ownDesign && admin && <> <span className="tag" title="Doesn’t follow the company design">Own design</span></>}
              <small>{[a.title, a.department].filter(Boolean).join(' · ') || 'No title yet'}</small><br />
              <small>/{a.path} · last tap {ago(a.last)}</small>
            </div>
            <div className="nums">
              <div><b>{a.taps}</b><small>NFC taps</small></div>
              <div><b>{a.views}</b><small>Views</small></div>
              <div><b>{a.clicks}</b><small>Clicks</small></div>
            </div>
            {admin ? <>
              <CopyButton text={`${O}/n/${a.path}`}>Copy NFC link</CopyButton>
              <button className={cls('signin', a.login && a.login.mustChange && 'new')} onClick={run(() => cardSignIn(a))}>
                <Icon k="people" size={14} /> {!a.login ? 'Create sign-in' : a.login.mustChange ? 'Sign-in details' : 'Signed in ✓'}
              </button>
              <span onClick={e => e.stopPropagation()}><Menu summary="•••" label="Card menu" className="row-mn">
                <button onClick={run(() => resetCompanyStats(c, a))} disabled={!a.views && !a.clicks}>Reset statistics…</button>
                <button className="dng" onClick={run(() => deleteAccount(a))}>Delete card…</button>
              </Menu></span>
            </> : <span className="vw"><Icon k="graph" size={15} /> View stats</span>}
          </div>
        ))}
        {!shown.length && <p style={{ color: 'var(--mut)' }}>{f ? 'No one matches your search.' : admin ? 'No cards yet. Set the company page and card design, then “+ Add card” or “Import from Excel”.' : 'No cards yet.'}</p>}
      </> : <CompanyStats c={c} onReset={admin ? run(() => resetCompanyStats(c)) : null} />}
    </main>
  </>;
}

// Combined statistics: 14-day chart, everyone ranked, devices, sources, recent clicks.
function CompanyStats({ c, onReset }) {
  const s = c.stats;
  const who = Object.fromEntries([[c.id, 'Company page'], ...c.members.map(a => [a.id, a.name])]);
  const rows = [{ id: c.id, name: 'Company page', ...c.page }, ...c.members].sort((a, b) => b.views - a.views || b.clicks - a.clicks);
  const mx = Math.max(1, ...rows.map(r => r.views));
  return <>
    {onReset && <div className="reset-row top"><small>Statistics of the company page and all its cards.</small>
      <button className="danger-btn" onClick={onReset}><Icon k="graph" size={14} /> Reset statistics…</button></div>}
    <div className="card"><h2>Last 14 days — all cards</h2><Chart days={s.days} /></div>
    <div className="card"><h2>Per person</h2><table className="rank"><thead><tr><th>Card</th><th>Taps</th><th>Views</th><th>Clicks</th></tr></thead><tbody>
      {rows.map(r => (
        <tr key={r.id} onClick={r.id === c.id ? undefined : () => navigate('/stats/' + r.id)} style={{ cursor: r.id === c.id ? 'default' : 'pointer' }}>
          <td>{r.id === c.id ? <i>{r.name}</i> : r.name}<div className="bar"><i style={{ width: `${r.views / mx * 100}%` }} /></div></td>
          <td>{r.taps}</td><td>{r.views}</td><td>{r.clicks}</td>
        </tr>
      ))}
    </tbody></table></div>
    <div className="grid2">
      <div className="card"><h2>Devices</h2><Table data={s.dev} /></div>
      <div className="card"><h2>Traffic source (nfc = card taps)</h2><Table data={s.src} /></div>
    </div>
    <div className="card"><h2>Recent clicks</h2><table><tbody>
      {s.recent.length ? s.recent.map((e, i) => (
        <tr key={i}><td>{e.title} <small style={{ color: 'var(--mut)', fontWeight: 400 }}>— {who[e.a] || 'deleted card'}</small></td>
          <td style={{ fontWeight: 400, color: 'var(--mut)' }}><span className="tag">{e.src}</span> {e.dev} · {ago(e.t)}</td></tr>
      )) : <tr><td style={{ color: 'var(--mut)' }}>No clicks yet</td></tr>}
    </tbody></table></div>
  </>;
}
