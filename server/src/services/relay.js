// iCloud Private Relay (Safari on iPhone / Mac with iCloud+). Safari's traffic then reaches us from one of Apple's
// relay addresses instead of the phone's own address. General IP-location services place those addresses where the
// relay companies are registered (often the United States), so a scan from Addis Ababa could show "United States".
// Apple publishes which region every relay address serves (https://mask-api.icloud.com/egress-ip-ranges.csv,
// lines like "172.224.0.0/24,US,US-CA,San Francisco"); this file loads that list (once a day) and answers
// "is this a relay address, and which country / city does Apple say it serves?".
const LIST_URL = 'https://mask-api.icloud.com/egress-ip-ranges.csv';
const DAY = 864e5;

let table = null;     // { v4: { s: Uint32Array, e: Uint32Array, l: Uint32Array }, v6: { s, e: BigUint64Array, l }, labels: [[cc, city]] }
let loadedAt = 0, failedAt = 0, loading = null;

/* ---------- addresses as numbers ---------- */
function v4(ip) {
  const p = ip.split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const x of p) { const v = +x; if (!/^\d{1,3}$/.test(x) || v > 255) return null; n = n * 256 + v; }
  return n;
}
// The first 64 bits of an IPv6 address (relay ranges are /64 or wider, so that is enough to place it).
function v6top(ip) {
  if (!ip.includes(':')) return null;
  let [head, tail = ''] = ip.split('::');
  if (ip.split('::').length > 2) return null;
  const h = head ? head.split(':') : [], t = tail ? tail.split(':') : [];
  if (t.length && t[t.length - 1].includes('.')) return null; // embedded IPv4: not used by the relay
  const groups = ip.includes('::') ? [...h, ...Array(8 - h.length - t.length).fill('0'), ...t] : h;
  if (groups.length !== 8 || groups.some(g => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
  return groups.slice(0, 4).reduce((a, g) => (a << 16n) | BigInt(parseInt(g, 16)), 0n);
}

/* ---------- the list ---------- */
function parse(csv) {
  const a4 = [], a6 = [], labels = [], labelIdx = new Map();
  for (const line of csv.split(/\r?\n/)) {
    const [cidr, cc, , city = ''] = line.split(',');
    if (!cidr || !/^[A-Z]{2}$/.test(cc || '')) continue;
    const [addr, bitsS] = cidr.split('/');
    const bits = +bitsS;
    const key = cc + '|' + city;
    let li = labelIdx.get(key);
    if (li === undefined) { li = labels.length; labels.push([cc, city.slice(0, 60)]); labelIdx.set(key, li); }
    const n4 = v4(addr);
    if (n4 !== null && bits >= 0 && bits <= 32) {
      const size = 2 ** (32 - bits), start = Math.floor(n4 / size) * size;
      a4.push([start, start + size - 1, li]);
      continue;
    }
    const n6 = v6top(addr);
    if (n6 !== null && bits >= 0 && bits <= 128) {
      const b = Math.min(bits, 64), span = (1n << BigInt(64 - b)) - 1n, start = n6 & ~span & 0xffffffffffffffffn;
      a6.push([start, start | span, li]);
    }
  }
  a4.sort((x, y) => x[0] - y[0]);
  a6.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  return {
    v4: { s: Uint32Array.from(a4, r => r[0]), e: Uint32Array.from(a4, r => r[1]), l: Uint32Array.from(a4, r => r[2]) },
    v6: { s: BigUint64Array.from(a6, r => r[0]), e: BigUint64Array.from(a6, r => r[1]), l: Uint32Array.from(a6, r => r[2]) },
    labels, ranges: a4.length + a6.length,
  };
}

function find(t, x) { // last range starting at or before x, if x is inside it
  let lo = 0, hi = t.s.length - 1, at = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (t.s[mid] <= x) { at = mid; lo = mid + 1; } else hi = mid - 1; }
  return at >= 0 && x <= t.e[at] ? t.l[at] : -1;
}

async function download() {
  const r = await fetch(LIST_URL, { signal: AbortSignal.timeout(30e3) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const t = parse(await r.text());
  if (t.ranges < 1000) throw new Error('list looks incomplete'); // keep the previous copy
  table = t; loadedAt = Date.now();
}

// Loads the list when it is missing or a day old (failed downloads are retried after an hour). Never throws.
function refresh() {
  if (String(process.env.GEO_LOOKUP).toLowerCase() === 'off') return Promise.resolve();
  const stale = !table || Date.now() - loadedAt > DAY;
  if (!stale || loading || Date.now() - failedAt < 36e5) return loading || Promise.resolve();
  loading = download().catch(e => { failedAt = Date.now(); console.error('iCloud Private Relay list not loaded:', e.message); })
    .finally(() => { loading = null; });
  return loading;
}

// { cc, city } when `ip` is an iCloud Private Relay address, otherwise null.
async function lookup(ip) {
  if (!table) await refresh(); else refresh();
  if (!table || !ip) return null;
  const n4 = v4(ip);
  const li = n4 !== null ? find(table.v4, n4) : (() => { const n6 = v6top(ip); return n6 === null ? -1 : find(table.v6, n6); })();
  return li >= 0 ? { cc: table.labels[li][0], city: table.labels[li][1] } : null;
}

module.exports = { lookup, refresh, parse, useList: csv => { table = parse(csv); loadedAt = Date.now(); }, status: () => ({ loaded: !!table, ranges: table ? table.ranges : 0, loadedAt }) };
