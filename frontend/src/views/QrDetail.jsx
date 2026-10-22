// One QR code: the code itself (design + downloads), what it opens, and everything about its scans.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getJson, send, uploadImage } from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { navigate } from '../lib/router.js';
import { ago, pickFiles, toData } from '../lib/utils.js';
import { qrSvg, qrUrl, downloadPng, downloadSvg } from '../lib/qrdraw.js';
import { Icon } from '../components/Icon.jsx';
import { CopyButton } from '../components/CopyButton.jsx';
import { confirmDialog } from '../components/Dialog.jsx';
import { Footer } from '../components/TopBar.jsx';
import { TYPE, TYPE_ICON, destination, editQr } from './QrCodes.jsx';

const TZ = -new Date().getTimezoneOffset(); // minutes from UTC: days and hours are shown in the admin's own time
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHAPES = [['square', 'Square'], ['rounded', 'Rounded'], ['dots', 'Dots']];
const COLORS = [['#111111', '#ffffff'], ['#1e1b4b', '#ffffff'], ['#4f46e5', '#ffffff'], ['#0e7490', '#ffffff'], ['#047857', '#ffffff'], ['#b91c1c', '#ffffff'], ['#ffffff', '#111111']];

const regionName = (() => { try { const d = new Intl.DisplayNames(undefined, { type: 'region' }); return c => (c === 'Unknown' ? c : d.of(c) || c); } catch { return c => c; } })();
const langName = (() => { try { const d = new Intl.DisplayNames(undefined, { type: 'language' }); return c => (c === 'Unknown' ? c : d.of(c) || c); } catch { return c => c; } })();
const flag = c => (/^[A-Z]{2}$/.test(c) ? String.fromCodePoint(...[...c].map(x => 0x1f1a5 + x.charCodeAt(0))) : '🌐');
const when = t => (t ? new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export function QrDetail({ id }) {
  const [q, setQ] = useState(null);
  const [style, setStyle] = useState(null);
  const [caption, setCaption] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    const d = await getJson(`/api/qr/${id}?tz=${TZ}`);
    setQ(d);
    setStyle(s => s || d.style);
  }, [id]);
  useEffect(() => { load().catch(() => { toast('That QR code was not found', { error: true }); navigate('/qr'); }); }, [load]);
  useEffect(() => { // new scans show up without reloading
    const t = setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 30e3);
    return () => clearInterval(t);
  }, [load]);

  // Design changes are saved on their own, a moment after the last change.
  const restyle = patch => {
    const next = { ...style, ...patch };
    setStyle(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => send('/api/qr/' + id, 'PUT', { style: next }, 'Could not save the design').catch(e => toast(e.message, { error: true })), 500);
  };

  const url = q && qrUrl(q.code);
  const big = useMemo(() => (q && style ? qrSvg(url, style, { caption: caption ? q.name : '' }) : ''), [q, url, style, caption]);
  if (!q || !style) return <header className="top"><button onClick={() => navigate('/qr')}><Icon k="back" size={14} /> QR codes</button></header>;

  const s = q.stats;
  const edit = async () => { if (await editQr(q)) { toast('Saved'); load(); } };
  const toggle = async () => {
    try { await send('/api/qr/' + id, 'PUT', { active: !q.active }); toast(q.active ? 'Paused: scanning shows “not active”' : 'Active again'); load(); } catch (e) { toast(e.message, { error: true }); }
  };
  const addLogo = async () => {
    const [f] = await pickFiles({ accept: 'image/*' });
    if (!f) return;
    try { restyle({ logo: await uploadImage(await toData(f, 400, 'image/png')) }); } catch (e) { toast(e.message, { error: true }); }
  };
  const reset = async () => {
    if (!(await confirmDialog({ title: 'Reset the statistics?', text: `All ${s.scans} recorded scans of “${q.name}” are deleted and counting starts again from zero. The QR code keeps working.`, confirm: 'Reset statistics' }))) return;
    await send(`/api/qr/${id}/reset`, 'POST');
    toast('Statistics reset');
    load();
  };
  const remove = async () => {
    if (!(await confirmDialog({ title: `Delete “${q.name}”?`, text: 'Printed copies will stop working (they show “QR code not found”) and its statistics are deleted. This can’t be undone.', confirm: 'Delete QR code' }))) return;
    const r = await api('/api/qr/' + id, 'DELETE');
    if (!r.ok) return toast('Could not delete', { error: true });
    toast('QR code deleted');
    navigate('/qr');
  };
  const dl = fn => fn(url, style, q.name, caption ? q.name : '').catch(() => toast('Could not make the file', { error: true }));

  return <>
    <header className="top">
      <button onClick={() => navigate('/qr')}><Icon k="back" size={14} /> QR codes</button>
      <b className="qr-title">{q.name}</b>{!q.active && <span className="tag warn">Paused</span>}<span className="sp" />
      <a href={url} target="_blank" rel="noopener"><button>Open <Icon k="open" size={13} /></button></a>
    </header>
    <main>
      <div className="qr-ed">
        <aside className="qr-panel">
          <div className="card">
            <div className={'qr-big' + (q.active ? '' : ' off')} dangerouslySetInnerHTML={{ __html: big }} />
            <div className="dom qr-link"><span>{url.replace(/^https?:\/\//, '')}</span><CopyButton text={url}>Copy</CopyButton></div>
            <div className="qr-dl">
              <button className="pri" onClick={() => dl(downloadPng)}><Icon k="download" size={14} /> PNG</button>
              <button onClick={() => dl(downloadSvg)}><Icon k="download" size={14} /> SVG</button>
            </div>
            <label className="ck qr-cap"><input type="checkbox" checked={caption} onChange={e => setCaption(e.target.checked)} /> Show the name under the code</label>
          </div>

          <div className="card">
            <h2>Opens</h2>
            <div className="qr-opens"><span className="chip"><Icon k={TYPE_ICON[q.type]} size={16} /></span>
              <div><b>{TYPE[q.type]}</b><small>{q.type === 'text' ? q.text.slice(0, 160) : destination(q)}</small></div></div>
            {q.note && <p className="hint" style={{ margin: '10px 0 0' }}>{q.note}</p>}
            <div className="qr-acts">
              <button onClick={edit}>Change…</button>
              <span className="sp" />
              <span className="stt">{q.active ? 'Active' : 'Paused'}</span>
              <button type="button" className={'tg' + (q.active ? ' on' : '')} aria-label={q.active ? 'Pause' : 'Activate'} title={q.active ? 'Pause this QR code' : 'Activate this QR code'} onClick={toggle} />
            </div>
          </div>

          <div className="card">
            <h2>Design</h2>
            <div className="seg">{SHAPES.map(([k, l]) => <button key={k} className={style.shape === k ? 'on' : ''} onClick={() => restyle({ shape: k })}>{l}</button>)}</div>
            <div className="qr-sw">
              {COLORS.map(([fg, bg]) => <button key={fg + bg} title="Use these colours" className={style.fg === fg && style.bg === bg ? 'on' : ''} style={{ background: bg }} onClick={() => restyle({ fg, bg })}><i style={{ background: fg }} /></button>)}
            </div>
            <div className="cr"><span>Code colour</span><input type="color" value={style.fg} onChange={e => restyle({ fg: e.target.value })} /></div>
            <div className="cr"><span>Background</span><input type="color" value={style.bg} onChange={e => restyle({ bg: e.target.value })} /></div>
            <div className="cr"><span>Logo in the middle</span>
              {style.logo
                ? <span className="row"><img className="qr-lg" src={style.logo} alt="" /><button onClick={() => restyle({ logo: '' })}>Remove</button></span>
                : <button onClick={addLogo}><Icon k="image" size={14} /> Add logo</button>}
            </div>
            <small className="hint">Keep the code dark on a light background so every phone can read it. Test it with your phone before printing.</small>
          </div>

          <div className="card qr-danger">
            <button onClick={reset} disabled={!s.scans}>Reset statistics</button>
            <button onClick={remove}><Icon k="trash" size={14} /> Delete</button>
          </div>
        </aside>

        <section>
          <div className="stats">
            <div className="st"><small>Total scans</small><div>{s.scans}</div></div>
            <div className="st"><small>Unique scanners</small><div>{s.unique}</div></div>
            <div className="st"><small>Today</small><div>{s.today}</div></div>
            <div className="st"><small>Last 7 days</small><div>{s.last7}</div></div>
          </div>
          <div className="qr-meta">
            <span>First scan: <b>{when(s.first)}</b></span>
            <span>Last scan: <b>{s.last ? `${when(s.last)} (${ago(s.last)})` : '—'}</b></span>
            <span>Created: <b>{when(q.created)}</b></span>
            <span className="sp" />
            <button onClick={() => load().then(() => toast('Up to date'))}>Refresh</button>
            <a href={`/api/qr/${id}/scans.xlsx?tz=${TZ}`}><button disabled={!s.scans}><Icon k="download" size={14} /> Excel</button></a>
          </div>

          <div className="card"><h2>Last 30 days</h2><DaysChart days={s.days} /></div>
          <div className="qr-grid">
            <div className="card"><h2>Time of day</h2><Bars values={s.hours} labels={s.hours.map((_, i) => (i % 3 ? '' : String(i).padStart(2, '0')))} titles={s.hours.map((n, i) => `${String(i).padStart(2, '0')}:00–${String(i).padStart(2, '0')}:59 · ${n} scans`)} /></div>
            <div className="card"><h2>Day of week</h2><Bars values={[1, 2, 3, 4, 5, 6, 0].map(i => s.week[i])} labels={[1, 2, 3, 4, 5, 6, 0].map(i => WEEK[i])} titles={[1, 2, 3, 4, 5, 6, 0].map(i => `${WEEK[i]} · ${s.week[i]} scans`)} /></div>
          </div>
          <div className="qr-grid">
            <Breakdown title="Devices" data={s.dev} />
            <Breakdown title="Phone system" data={s.os} />
            <Breakdown title="Browser / app" data={s.br} />
            <Breakdown title="Country" data={s.cc} label={c => <>{flag(c)} {regionName(c)}</>}
              hint={Object.keys(s.cc).length && Object.keys(s.cc).every(k => k === 'Unknown') ? 'The country comes from your host (Vercel or Cloudflare add it). It shows as Unknown when the server is reached directly.' : ''} />
            <Breakdown title="Language" data={s.lang} label={langName} />
          </div>
          <div className="card"><h2>Recent scans</h2>
            <table className="qr-recent"><tbody>
              {s.recent.length ? s.recent.map((e, i) => (
                <tr key={i}>
                  <td><b>{ago(e.t)}</b><small>{when(e.t)}</small></td>
                  <td>{e.dev} · {e.os} · {e.br}</td>
                  <td>{e.cc !== 'Unknown' ? <>{flag(e.cc)} {regionName(e.cc)}{e.city ? `, ${e.city}` : ''}</> : <span style={{ color: 'var(--mut)' }}>—</span>}</td>
                  <td>{e.nw ? <span className="tag">New</span> : <span className="tag rep">Again</span>}</td>
                </tr>
              )) : <tr><td className="empty">No scans yet. Scan the code with your phone to test it.</td></tr>}
            </tbody></table>
          </div>
        </section>
      </div>
    </main>
    <Footer />
  </>;
}

function DaysChart({ days }) {
  const W = 640, H = 180, P = 22;
  const mx = Math.max(1, ...days.map(d => d.n)), bw = (W - P * 2) / days.length, y = v => H - P - (v / mx) * (H - P * 2);
  return <>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%">
      {[0.5, 1].map(f => <line key={f} x1={P} x2={W - P} y1={y(mx * f)} y2={y(mx * f)} stroke="#e1e7f2" strokeDasharray="3 4" />)}
      <text x={P} y={y(mx) - 5} fontSize="10" fill="#66728c">{mx}</text>
      {days.map((d, i) => <rect key={i} x={P + i * bw + 2} y={y(d.n)} width={bw - 4} height={H - P - y(d.n)} rx="3" fill="rgba(79,70,229,.6)"><title>{`${d.d}: ${d.n} scans, ${d.u} people (${d.nw} new)`}</title></rect>)}
      <path d={days.map((d, i) => `${i ? 'L' : 'M'}${P + i * bw + bw / 2},${y(d.u)}`).join(' ')} fill="none" stroke="#06b6d4" strokeWidth="2.5" />
      {days.map((d, i) => (i % 5 ? null : <text key={'t' + i} x={P + i * bw + bw / 2} y={H - 6} fill="#66728c" fontSize="10" textAnchor="middle">{d.d.slice(5)}</text>))}
    </svg>
    <small style={{ color: 'var(--mut)' }}>■ Scans &nbsp; <span style={{ color: '#06b6d4' }}>●</span> People (unique per day)</small>
  </>;
}

function Bars({ values, labels, titles }) {
  const W = 320, H = 120, P = 16, mx = Math.max(1, ...values), bw = (W - P * 2) / values.length;
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%">
    {values.map((v, i) => <rect key={i} x={P + i * bw + 1.5} y={H - P - (v / mx) * (H - P * 2)} width={bw - 3} height={(v / mx) * (H - P * 2) || 0.5} rx="2" fill={v === mx && v ? '#4f46e5' : 'rgba(79,70,229,.45)'}><title>{titles[i]}</title></rect>)}
    {labels.map((l, i) => (l ? <text key={i} x={P + i * bw + bw / 2} y={H - 3} fontSize="9" fill="#66728c" textAnchor="middle">{l}</text> : null))}
  </svg>;
}

function Breakdown({ title, data, label = x => x, hint = '' }) {
  const rows = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((a, [, n]) => a + n, 0) || 1;
  return <div className="card"><h2>{title}</h2>
    <table><tbody>
      {rows.length ? rows.slice(0, 8).map(([k, n]) => (
        <tr key={k}><td>{label(k)}<div className="bar"><i style={{ width: `${n / total * 100}%` }} /></div></td><td>{n}<small className="pc">{Math.round(n / total * 100)}%</small></td></tr>
      )) : <tr><td className="empty">No scans yet</td></tr>}
    </tbody></table>
    {hint && <small className="hint" style={{ marginTop: 8 }}>{hint}</small>}
  </div>;
}
