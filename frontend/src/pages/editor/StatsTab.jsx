// "Analytics" tab: totals, 14-day chart, per-link clicks, devices, sources, recent clicks.
import { Icon } from '../../icons.jsx';
import { ago } from '../../utils.js';

function Chart({ days }) {
  const W = 640, H = 170, P = 22;
  const mx = Math.max(1, ...days.map(d => Math.max(d.v, d.c)));
  const bw = (W - P * 2) / days.length;
  const y = v => H - P - (v / mx) * (H - P * 2);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Views and clicks per day for the last 14 days">
        {days.map((d, i) => (
          <rect key={d.d} x={P + i * bw + 4} y={y(d.v)} width={bw - 8} height={H - P - y(d.v)} rx="4" fill="rgba(79,70,229,.55)"><title>{d.d}: {d.v} views</title></rect>
        ))}
        <path d={days.map((d, i) => `${i ? 'L' : 'M'}${P + i * bw + bw / 2},${y(d.c)}`).join(' ')} fill="none" stroke="#f59e0b" strokeWidth="3" />
        {days.map((d, i) => (i % 3 ? null : <text key={d.d} x={P + i * bw + bw / 2} y={H - 6} fill="#66728c" fontSize="10" textAnchor="middle">{d.d.slice(5)}</text>))}
      </svg>
      <small style={{ color: 'var(--mut)' }}>■ Views &nbsp; <span style={{ color: '#f59e0b' }}>●</span> Clicks</small>
    </>
  );
}

const Counts = ({ data }) => {
  const rows = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  return <table><tbody>{rows.length ? rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>) : <tr><td style={{ color: 'var(--mut)' }}>No data yet</td></tr>}</tbody></table>;
};

export default function StatsTab({ ed }) {
  const { account, stats: s } = ed;
  if (!s) return <p style={{ color: 'var(--mut)' }}>Loading analytics…</p>;
  const links = account.blocks.flatMap(b => (b.type === 'links' || b.type === 'social' ? b.items : b.type === 'contact' ? [{ id: b.id, ico: 'contact', title: b.label }] : []));
  const byLink = s.byLink || {};
  const mx = Math.max(1, ...Object.values(byLink));
  return (
    <>
      <div className="stats">
        <div className="st"><small>NFC taps</small><div>{s.taps}</div></div>
        <div className="st"><small>Views</small><div>{s.views}</div></div>
        <div className="st"><small>Clicks</small><div>{s.clicks}</div></div>
        <div className="st"><small>Click rate</small><div>{s.views ? Math.round((s.clicks / s.views) * 100) : 0}%</div></div>
      </div>
      <div className="card"><h2>Last 14 days</h2><Chart days={s.days} /></div>
      <div className="card"><h2>Per link</h2>
        <table><tbody>
          {links.map(l => (
            <tr key={l.id}>
              <td>{l.ico ? <Icon name={l.ico} size={15} /> : l.icon} {l.title || '(untitled)'}<div className="bar"><i style={{ width: `${((byLink[l.id] || 0) / mx) * 100}%` }} /></div></td>
              <td>{byLink[l.id] || 0}</td>
            </tr>
          ))}
          {!links.length && <tr><td>No links</td></tr>}
        </tbody></table>
      </div>
      <div className="card"><h2>Devices</h2><Counts data={s.dev} /></div>
      <div className="card"><h2>Traffic source (nfc = card taps)</h2><Counts data={s.src} /></div>
      <div className="card"><h2>Recent clicks</h2>
        <table><tbody>
          {s.recent.map((e, i) => (
            <tr key={i}><td>{e.title}</td><td style={{ fontWeight: 400, color: 'var(--mut)' }}><span className="tag">{e.src}</span> {e.dev} · {ago(e.t)}</td></tr>
          ))}
          {!s.recent.length && <tr><td style={{ color: 'var(--mut)' }}>No clicks yet</td></tr>}
        </tbody></table>
      </div>
    </>
  );
}
