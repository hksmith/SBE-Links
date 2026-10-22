// Dashboard: the whole system at a glance — today, this week, 30-day activity, best cards and QR codes,
// companies, devices, traffic sources and the latest activity. Refreshes by itself.
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../AppContext.js';
import { getJson } from '../lib/api.js';
import { ago } from '../lib/utils.js';
import { navigate } from '../lib/router.js';
import { useLive } from '../lib/live.js';
import { Icon } from '../components/Icon.jsx';
import { PageHeader } from '../components/TopBar.jsx';
import { newAccount } from './accountActions.jsx';
import { newCompany } from './companyActions.jsx';
import { QrThumb } from './QrCodes.jsx';

const TZ = -new Date().getTimezoneOffset();
const COLORS = { v: 'var(--a)', t: 'var(--b)', c: '#f59e0b', s: '#10b981' };
const KIND = { view: ['eye', 'Page view'], tap: ['card', 'NFC tap'], click: ['link', 'Link click'], scan: ['qr', 'QR scan'] };

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
const flag = c => (/^[A-Z]{2}$/.test(c || '') ? String.fromCodePoint(...[...c].map(x => 0x1f1a5 + x.charCodeAt(0))) + ' ' : '');

export function Home() {
  const { me, isAdmin } = useApp();
  const [o, setO] = useState(null);
  const [range, setRange] = useState(30);
  const load = useCallback(async () => setO(await getJson('/api/overview?tz=' + TZ)), []);
  useEffect(() => { load().catch(() => {}); }, [load]);
  const updated = useLive(load);

  const actions = isAdmin && <div className="ph-acts">
    <button onClick={newAccount}><Icon k="card" size={14} /> New card</button>
    <button onClick={newCompany}><Icon k="building" size={14} /> New company</button>
    <button className="pri" onClick={() => navigate('/qr')}><Icon k="qr" size={14} /> QR codes</button>
  </div>;

  if (!o) return <PageHeader title="Dashboard" sub={`${greeting()}, ${me.name}`}>{actions}</PageHeader>;
  const qr = isAdmin;
  const kpis = [
    { k: 't', label: 'NFC taps', icon: 'card', total: o.totals.taps, today: o.today.taps, week: o.week.taps, prev: o.prevWeek.taps },
    { k: 'v', label: 'Page views', icon: 'eye', total: o.totals.views, today: o.today.views, week: o.week.views, prev: o.prevWeek.views },
    { k: 'c', label: 'Link clicks', icon: 'link', total: o.totals.clicks, today: o.today.clicks, week: o.week.clicks, prev: o.prevWeek.clicks },
    ...(qr ? [{ k: 's', label: 'QR scans', icon: 'qr', total: o.totals.scans, today: o.today.scans, week: o.week.scans, prev: o.prevWeek.scans }] : []),
  ];
  const days = o.days.slice(-range);

  return <>
    <PageHeader title="Dashboard" sub={`${greeting()}, ${me.name}`} live={updated}>{actions}</PageHeader>
    <main className="wide">
      <div className="kpis">
        {kpis.map(x => <Kpi key={x.k} x={x} days={o.days} />)}
      </div>

      <div className="counts">
        <button onClick={() => navigate(isAdmin || !me.company ? '/cards' : '/company/' + me.company)}><Icon k="card" size={18} /><b>{o.counts.cards}</b><span>Cards</span></button>
        {(isAdmin || o.counts.companies > 0) && <button onClick={() => navigate(isAdmin ? '/companies' : '/company/' + me.company)}><Icon k="building" size={18} /><b>{o.counts.companies}</b><span>{o.counts.companies === 1 ? 'Company' : 'Companies'}</span></button>}
        {qr && <button onClick={() => navigate('/qr')}><Icon k="qr" size={18} /><b>{o.counts.qr}</b><span>QR codes · {o.counts.qrActive} active</span></button>}
        <div className="cnt-last"><small>Last visit to a card</small><b>{ago(o.totals.last)}</b></div>
      </div>

      <div className="dash-row">
        <div className="card">
          <div className="card-h"><h2>Activity</h2><span className="sp" />
            <div className="seg sm">{[7, 14, 30].map(n => <button key={n} className={range === n ? 'on' : ''} onClick={() => setRange(n)}>{n} days</button>)}</div>
          </div>
          <ActivityChart days={days} qr={qr} />
        </div>
        <div className="card feed">
          <h2>Latest activity</h2>
          {o.recent.length ? o.recent.map((r, i) => (
            <div key={i} className={'fi' + (r.go ? ' go' : '')} onClick={r.go ? () => navigate(r.go) : undefined}>
              <span className={'fi-ic k-' + r.kind}><Icon k={KIND[r.kind][0]} size={14} /></span>
              <div><b>{r.name}</b><small>{KIND[r.kind][1]}{r.what ? ` · ${r.what}` : ''}{r.cc ? ` · ${flag(r.cc)}${r.cc}` : ''}{r.dev && r.kind !== 'scan' ? ` · ${r.dev}` : ''}</small></div>
              <time>{ago(r.t)}</time>
            </div>
          )) : <p className="empty-p">Nothing yet. Taps, views, clicks{qr ? ' and QR scans' : ''} show up here as they happen.</p>}
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-h"><h2>Top cards</h2><span className="sp" /><a href={isAdmin || !me.company ? '#/cards' : '#/company/' + me.company} className="more">All cards →</a></div>
          <table className="rank"><thead><tr><th>Card</th><th>Taps</th><th>Views</th><th>Clicks</th></tr></thead><tbody>
            {o.topCards.length ? o.topCards.map(a => (
              <tr key={a.id} onClick={() => navigate(a.go)} style={{ cursor: 'pointer' }}>
                <td><div className="who-c">{a.photo ? <img className="av sm" src={a.photo} alt="" /> : <span className="av sm">{a.name[0].toUpperCase()}</span>}
                  <div><b>{a.name}</b><small>{a.company || a.title || '/' + a.path}</small></div></div></td>
                <td>{a.taps}</td><td>{a.views}</td><td>{a.clicks}</td>
              </tr>
            )) : <tr><td className="empty">No cards yet</td></tr>}
          </tbody></table>
        </div>

        {qr && <div className="card">
          <div className="card-h"><h2>Top QR codes</h2><span className="sp" /><a href="#/qr" className="more">All QR codes →</a></div>
          {o.topQr.length ? o.topQr.map(q => (
            <div key={q.id} className="qr-mini" onClick={() => navigate('/qr/' + q.id)}>
              <QrThumb q={q} size={40} />
              <div><b>{q.name}{!q.active && <span className="tag warn" style={{ marginLeft: 6 }}>Paused</span>}</b><small>{q.unique} unique · last scan {ago(q.last)}</small></div>
              <strong>{q.scans}</strong>
            </div>
          )) : <p className="empty-p">No QR codes yet. <a href="#/qr">Make one →</a></p>}
        </div>}

        {o.companies.length > 0 && <div className="card">
          <div className="card-h"><h2>Companies</h2><span className="sp" />{isAdmin && <a href="#/companies" className="more">All companies →</a>}</div>
          {o.companies.map(c => (
            <div key={c.id} className="qr-mini" onClick={() => navigate('/company/' + c.id)}>
              {c.logo ? <img className="co-mini" src={c.logo} alt="" /> : <span className="co-mini"><Icon k="building" size={18} /></span>}
              <div><b>{c.name}</b><small>{c.members} card{c.members === 1 ? '' : 's'} · {c.taps} taps · {c.clicks} clicks</small></div>
              <strong>{c.views}<small>views</small></strong>
            </div>
          ))}
        </div>}

        <Share title="Devices" data={o.dev} />
        <Share title="Where visits come from" data={o.src} label={k => (k === 'nfc' ? 'NFC card tap' : k === 'direct' ? 'Direct / link' : k)} />
      </div>
    </main>
  </>;
}

function Spark({ values, color }) {
  const W = 120, H = 34, mx = Math.max(1, ...values), st = W / (values.length - 1);
  const pts = values.map((v, i) => `${(i * st).toFixed(1)},${(H - 3 - (v / mx) * (H - 6)).toFixed(1)}`);
  return <svg viewBox={`0 0 ${W} ${H}`} className="spark" preserveAspectRatio="none">
    <path d={`M0,${H} L${pts.join(' L')} L${W},${H}Z`} style={{ fill: color, opacity: 0.12 }} />
    <path d={`M${pts.join(' L')}`} style={{ stroke: color }} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" />
  </svg>;
}

function Kpi({ x, days }) {
  const ch = x.prev ? Math.round((x.week - x.prev) / x.prev * 100) : x.week ? 100 : 0;
  return <div className="kpi" style={{ '--c': COLORS[x.k] }}>
    <div className="kpi-h"><span className="kpi-ic"><Icon k={x.icon} size={16} /></span><small>{x.label}</small></div>
    <div className="kpi-n">{x.total.toLocaleString()}</div>
    <div className="kpi-s">
      <span><b>+{x.today}</b> today</span>
      <span className={ch > 0 ? 'up' : ch < 0 ? 'down' : ''} title="Last 7 days compared with the 7 days before">{ch > 0 ? '▲' : ch < 0 ? '▼' : '•'} {Math.abs(ch)}% this week</span>
    </div>
    <Spark values={days.slice(-14).map(d => d[x.k])} color={COLORS[x.k]} />
  </div>;
}

function ActivityChart({ days, qr }) {
  const W = 760, H = 230, P = 28;
  const series = [['v', 'Page views'], ['t', 'NFC taps'], ['c', 'Link clicks'], ...(qr ? [['s', 'QR scans']] : [])];
  const mx = Math.max(1, ...days.flatMap(d => series.map(([k]) => d[k])));
  const bw = (W - P * 2) / days.length, y = v => H - P - (v / mx) * (H - P * 2), cx = i => P + i * bw + bw / 2;
  const every = Math.ceil(days.length / 8);
  return <>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="act">
      {[0, 0.5, 1].map(f => <g key={f}><line x1={P} x2={W - P} y1={y(mx * f)} y2={y(mx * f)} stroke="var(--line)" strokeDasharray={f ? '3 4' : ''} />
        <text x={P - 6} y={y(mx * f) + 3} fontSize="10" textAnchor="end" style={{ fill: 'var(--mut)' }}>{Math.round(mx * f)}</text></g>)}
      {days.map((d, i) => <rect key={i} x={P + i * bw + bw * 0.18} y={y(d.v)} width={bw * 0.64} height={H - P - y(d.v)} rx="3" style={{ fill: 'rgba(var(--a-rgb),.55)' }}>
        <title>{`${d.d} · ${d.v} views · ${d.t} taps · ${d.c} clicks${qr ? ` · ${d.s} QR scans` : ''}`}</title></rect>)}
      {series.slice(1).map(([k]) => <path key={k} d={days.map((d, i) => `${i ? 'L' : 'M'}${cx(i)},${y(d[k])}`).join(' ')} fill="none" style={{ stroke: COLORS[k] }} strokeWidth="2.5" strokeLinejoin="round" />)}
      {days.map((d, i) => ((days.length - 1 - i) % every ? null : <text key={'x' + i} x={cx(i)} y={H - 8} fontSize="10" textAnchor="middle" style={{ fill: 'var(--mut)' }}>{d.d.slice(5)}</text>))}
    </svg>
    <div className="legend">{series.map(([k, l]) => <span key={k}><i style={{ background: COLORS[k], borderRadius: k === 'v' ? 3 : 9 }} />{l}</span>)}</div>
  </>;
}

function Share({ title, data, label = k => k }) {
  const rows = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((a, [, n]) => a + n, 0) || 1;
  return <div className="card"><h2>{title}</h2>
    <table><tbody>
      {rows.length ? rows.slice(0, 6).map(([k, n]) => (
        <tr key={k}><td>{label(k)}<div className="bar"><i style={{ width: `${n / total * 100}%` }} /></div></td><td>{n}<small className="pc">{Math.round(n / total * 100)}%</small></td></tr>
      )) : <tr><td className="empty">No visits yet</td></tr>}
    </tbody></table>
  </div>;
}
