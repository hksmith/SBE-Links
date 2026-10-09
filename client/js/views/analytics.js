// "Analytics" tab: totals, 14-day chart, per-link clicks, devices, sources, recent clicks.
import { S } from '../state.js';
import { IC } from '../icons.js';
import { esc, ago } from '../utils.js';

function chart(days){const W=640,H=170,Pd=22,mx=Math.max(1,...days.map(d=>Math.max(d.v,d.c))),bw=(W-Pd*2)/days.length,y=v=>H-Pd-(v/mx)*(H-Pd*2);
 return `<svg viewBox="0 0 ${W} ${H}" width="100%">${days.map((d,i)=>`<rect x="${Pd+i*bw+4}" y="${y(d.v)}" width="${bw-8}" height="${H-Pd-y(d.v)}" rx="4" fill="rgba(79,70,229,.55)"><title>${d.d}: ${d.v} views</title></rect>`).join('')}<path d="${days.map((d,i)=>`${i?'L':'M'}${Pd+i*bw+bw/2},${y(d.c)}`).join(' ')}" fill="none" stroke="#f59e0b" stroke-width="3"/>${days.map((d,i)=>i%3?'':`<text x="${Pd+i*bw+bw/2}" y="${H-6}" fill="#66728c" font-size="10" text-anchor="middle">${d.d.slice(5)}</text>`).join('')}</svg><small style="color:var(--mut)">■ Views &nbsp; <span style="color:#f59e0b">●</span> Clicks</small>`}
export function statsUI(P){const s=S.stats,cur=S.cur,tb=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')||'<tr><td style="color:var(--mut)">No data yet</td></tr>';
 const links=cur.blocks.flatMap(b=>b.type==='links'||b.type==='social'?b.items:b.type==='contact'?[{id:b.id,ico:'contact',title:b.label}]:[]),mx=Math.max(1,...Object.values(s.byLink));
 P.innerHTML=`<div class="stats"><div class="st"><small>NFC taps</small><div>${s.taps}</div></div><div class="st"><small>Views</small><div>${s.views}</div></div><div class="st"><small>Clicks</small><div>${s.clicks}</div></div><div class="st"><small>Click rate</small><div>${s.views?Math.round(s.clicks/s.views*100):0}%</div></div></div>
 <div class="card"><h2>Last 14 days</h2>${chart(s.days)}</div><div class="card"><h2>Per link</h2><table>${links.map(l=>`<tr><td>${l.ico?IC(l.ico,15):esc(l.icon||'')} ${esc(l.title)||'(untitled)'}<div class="bar"><i style="width:${(s.byLink[l.id]||0)/mx*100}%"></i></div></td><td>${s.byLink[l.id]||0}</td></tr>`).join('')||'<tr><td>No links</td></tr>'}</table></div>
 <div class="card"><h2>Devices</h2><table>${tb(s.dev)}</table></div><div class="card"><h2>Traffic source (nfc = card taps)</h2><table>${tb(s.src)}</table></div>
 <div class="card"><h2>Recent clicks</h2><table>${s.recent.map(e=>`<tr><td>${esc(e.title)}</td><td style="font-weight:400;color:var(--mut)"><span class="tag">${esc(e.src)}</span> ${esc(e.dev)} · ${ago(e.t)}</td></tr>`).join('')||'<tr><td style="color:var(--mut)">No clicks yet</td></tr>'}</table></div>`}
