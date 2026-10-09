// Analytics: recording views/clicks and building the numbers shown in the admin.
const events = require('../repositories/events');

const BOT = /bot|crawl|spider|preview|facebookexternalhit|slurp|headless/i;
const device = ua => (/iphone|ipad|ios/i.test(ua) ? 'iOS' : /android/i.test(ua) ? 'Android' : /mobile/i.test(ua) ? 'Mobile' : 'Desktop');
const sourceOf = url => (url.searchParams.get('s') || 'direct').replace(/[^\w-]/g, '').slice(0, 20) || 'direct';
const blank = () => ({ views: 0, taps: 0, clicks: 0, last: 0 });

// Fire-and-forget so a slow database never delays a redirect or page view.
function track(e) {
  events.record(e).catch(err => console.error('Could not record event:', err.message));
}

async function listStats() {
  const m = {};
  for (const s of await events.totals()) m[s._id] = { views: s.views || 0, taps: s.taps || 0, clicks: s.clicks || 0, last: s.last || 0 };
  return m;
}

async function detail(account) {
  const day = t => new Date(t).toISOString().slice(0, 10);
  const days = [...Array(14)].map((_, i) => day(Date.now() - (13 - i) * 864e5));
  const idx = Object.fromEntries(days.map((d, i) => [d, i]));
  const tot = (await events.totalsFor(account.id)) || {};
  const s = {
    ...blank(), views: tot.views || 0, taps: tot.taps || 0, clicks: tot.clicks || 0, last: tot.last || 0,
    days: days.map(d => ({ d, v: 0, c: 0 })), byLink: tot.byLink || {}, dev: tot.dev || {}, src: tot.src || {}, recent: [],
  };
  for (const e of await events.since(account.id, Date.parse(days[0]))) {
    const i = idx[day(e.t)];
    if (i == null) continue;
    if (e.k === 'view') s.days[i].v++; else s.days[i].c++;
  }
  s.recent = await events.recentClicks(account.id, 15);
  return s;
}

module.exports = { BOT, device, sourceOf, blank, track, listStats, detail };
