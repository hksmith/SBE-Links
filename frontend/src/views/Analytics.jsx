// Statistics panel: totals, 14-day chart, per-link clicks, devices, sources, recent clicks.
import { ago } from '../lib/utils.js';
import { Icon } from '../components/Icon.jsx';

function Chart({ days }) {
  const W = 640, H = 170, Pd = 22;
  const mx = Math.max(1, ...days.map(d => Math.max(d.v, d.c))), bw = (W - Pd * 2) / days.length, y = v => H - Pd - (v / mx) * (H - Pd * 2);
  return <>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%">
      {days.map((d, i) => (
        <rect key={i} x={Pd + i * bw + 4} y={y(d.v)} width={bw - 8} height={H - Pd - y(d.v)} rx="4" fill="rgba(79,70,229,.55)"><title>{`${d.d}: ${d.v} views`}</title></rect>
      ))}
      <path d={days.map((d, i) => `${i ? 'L' : 'M'}${Pd + i * bw + bw / 2},${y(d.c)}`).join(' ')} fill="none" stroke="#f59e0b" strokeWidth="3" />
      {days.map((d, i) => i % 3 ? null : <text key={'t' + i} x={Pd + i * bw + bw / 2} y={H - 6} fill="#66728c" fontSize="10" textAnchor="middle">{d.d.slice(5)}</text>)}
    </svg>
    <small style={{ color: 'var(--mut)' }}>■ Views &nbsp; <span style={{ color: '#f59e0b' }}>●</span> Clicks</small>
  </>;
}

function Table({ data }) {
  const rows = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  return <table><tbody>
    {rows.length ? rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>) : <tr><td style={{ color: 'var(--mut)' }}>No data yet</td></tr>}
  </tbody></table>;
}

export function Analytics({ account, stats: s }) {
  const links = account.blocks.flatMap(b => b.type === 'links' || b.type === 'social' ? b.items : b.type === 'contact' ? [{ id: b.id, ico: 'contact', title: b.label }] : []);
  const mx = Math.max(1, ...Object.values(s.byLink));
  return <>
    <div className="stats">
      <div className="st"><small>NFC taps</small><div>{s.taps}</div></div>
      <div className="st"><small>Views</small><div>{s.views}</div></div>
      <div className="st"><small>Clicks</small><div>{s.clicks}</div></div>
      <div className="st"><small>Click rate</small><div>{s.views ? Math.round(s.clicks / s.views * 100) : 0}%</div></div>
    </div>
    <div className="card"><h2>Last 14 days</h2><Chart days={s.days} /></div>
    <div className="card"><h2>Per link</h2><table><tbody>
      {links.length ? links.map((l, i) => (
        <tr key={l.id || i}>
          <td>{l.ico ? <Icon k={l.ico} size={15} /> : l.icon || ''} {l.title || '(untitled)'}<div className="bar"><i style={{ width: `${(s.byLink[l.id] || 0) / mx * 100}%` }} /></div></td>
          <td>{s.byLink[l.id] || 0}</td>
        </tr>
      )) : <tr><td>No links</td></tr>}
    </tbody></table></div>
    <div className="card"><h2>Devices</h2><Table data={s.dev} /></div>
    <div className="card"><h2>Traffic source (nfc = card taps)</h2><Table data={s.src} /></div>
    <div className="card"><h2>Recent clicks</h2><table><tbody>
      {s.recent.length ? s.recent.map((e, i) => (
        <tr key={i}><td>{e.title}</td><td style={{ fontWeight: 400, color: 'var(--mut)' }}><span className="tag">{e.src}</span> {e.dev} · {ago(e.t)}</td></tr>
      )) : <tr><td style={{ color: 'var(--mut)' }}>No clicks yet</td></tr>}
    </tbody></table></div>
  </>;
}
