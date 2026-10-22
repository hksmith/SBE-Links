// Dashboard numbers and system settings.
//   GET /api/overview?tz=<minutes>   everything the dashboard shows, limited to what the signed-in user may see
//                                    (QR codes only for admins)
//   GET /api/system                  system name, logo and theme (everyone signed in)
//   PUT /api/system                  change them (admins; registered after the admin-only guard)
const auth = require('../services/auth');
const accounts = require('../repositories/accounts');
const companiesRepo = require('../repositories/companies');
const events = require('../repositories/events');
const qrRepo = require('../repositories/qrcodes');
const stats = require('../services/stats');
const system = require('../services/system');
const pages = require('../services/pages');
const { json, readJson } = require('../lib/http');

const DAYS = 30;

async function overview(user, tz) {
  const admin = auth.isAdmin(user);
  const off = Math.max(-840, Math.min(840, Number(tz) || 0)) * 6e4;
  const dayOf = t => new Date(t + off).toISOString().slice(0, 10);
  const now = Date.now();
  const days = [...Array(DAYS)].map((_, i) => ({ d: dayOf(now - (DAYS - 1 - i) * 864e5), v: 0, t: 0, c: 0, s: 0 }));
  const idx = Object.fromEntries(days.map((d, i) => [d.d, i]));
  const start = Date.parse(days[0].d + 'T00:00:00Z') - off;

  const [allAccounts, allCompanies, st, qrs] = await Promise.all([accounts.list(), companiesRepo.list(), stats.listStats(), admin ? qrRepo.list() : []]);
  const cos = allCompanies.filter(c => auth.canSee(user, { ...c, isCompany: true }));
  const coById = Object.fromEntries(allCompanies.map(c => [c.id, c]));
  const cards = allAccounts.filter(a => auth.canSee(user, a));
  const ids = [...cards.map(a => a.id), ...cos.map(c => c.id)];
  const names = Object.fromEntries([...cards.map(a => [a.id, { name: a.profile.name || '/' + a.slug, go: (admin ? '/edit/' : '/stats/') + a.id }]),
    ...cos.map(c => [c.id, { name: `${c.name} (company page)`, go: '/company/' + c.id }])]);

  for (const e of await events.activitySince(ids, start)) {
    const b = days[idx[dayOf(e.t)]];
    if (!b) continue;
    if (e.k === 'click') b.c++; else { b.v++; if (e.src === 'nfc') b.t++; }
  }
  if (admin) for (const s of await qrRepo.allScansSince(start)) { const b = days[idx[dayOf(s.t)]]; if (b) b.s++; }

  const raw = Object.fromEntries((await events.totals()).map(x => [x._id, x])); // with devices and sources
  const tot = stats.sum(ids.map(id => raw[id]));
  const qrTot = qrs.reduce((a, q) => ({ scans: a.scans + ((q.st && q.st.scans) || 0), unique: a.unique + ((q.st && q.st.unique) || 0) }), { scans: 0, unique: 0 });
  const sumDays = (from, k) => days.slice(from).reduce((a, d) => a + d[k], 0);
  const period = from => ({ views: sumDays(from, 'v'), taps: sumDays(from, 't'), clicks: sumDays(from, 'c'), scans: sumDays(from, 's') });

  // Latest activity: views, taps and clicks of the cards, plus QR scans.
  const qrName = Object.fromEntries(qrs.map(q => [q.id, q.name]));
  const recent = [
    ...(await events.recentMany(ids, 20)).map(e => ({
      t: e.t, kind: e.k === 'click' ? 'click' : e.src === 'nfc' ? 'tap' : 'view', name: (names[e.a] || {}).name || 'Deleted card',
      go: (names[e.a] || {}).go || null, what: e.k === 'click' ? e.title || 'a link' : e.src && e.src !== 'direct' && e.src !== 'nfc' ? `from ${e.src}` : '', dev: e.dev || '',
    })),
    ...(admin ? (await qrRepo.recentAll(20)).map(s => ({
      t: s.t, kind: 'scan', name: qrName[s.q] || 'Deleted QR code', go: qrName[s.q] ? '/qr/' + s.q : null,
      what: [s.os, s.br].filter(Boolean).join(' · '), dev: s.dev || '', cc: s.cc && s.cc !== 'Unknown' ? s.cc : '',
    })) : []),
  ].sort((a, b) => b.t - a.t).slice(0, 20);

  const cardRow = a => {
    const c = a.company ? coById[a.company] : null, s = st[a.id] || stats.blank();
    return { id: a.id, name: a.profile.name || '(no name)', title: a.profile.title || '', company: c ? c.name : '', photo: a.profile.photo || '',
      path: pages.pathOf(a, c), go: (admin ? '/edit/' : '/stats/') + a.id, views: s.views, taps: s.taps, clicks: s.clicks, last: s.last };
  };

  return {
    counts: { cards: cards.length, companies: cos.length, qr: qrs.length, qrActive: qrs.filter(q => q.active !== false).length },
    totals: { views: tot.views, taps: tot.taps, clicks: tot.clicks, scans: qrTot.scans, qrUnique: qrTot.unique, last: tot.last },
    today: period(DAYS - 1), week: period(DAYS - 7), month: period(0),
    prevWeek: { views: days.slice(DAYS - 14, DAYS - 7).reduce((a, d) => a + d.v, 0), clicks: days.slice(DAYS - 14, DAYS - 7).reduce((a, d) => a + d.c, 0), taps: days.slice(DAYS - 14, DAYS - 7).reduce((a, d) => a + d.t, 0), scans: days.slice(DAYS - 14, DAYS - 7).reduce((a, d) => a + d.s, 0) },
    days, dev: tot.dev, src: tot.src,
    topCards: cards.map(cardRow).sort((a, b) => b.views + b.clicks - (a.views + a.clicks)).slice(0, 6),
    topQr: qrs.map(q => ({ id: q.id, name: q.name, code: q.code, type: q.type, active: q.active !== false, style: q.style, scans: (q.st && q.st.scans) || 0, unique: (q.st && q.st.unique) || 0, last: (q.st && q.st.last) || 0 }))
      .sort((a, b) => b.scans - a.scans).slice(0, 5),
    companies: cos.map(c => {
      const members = allAccounts.filter(a => a.company === c.id);
      const t = stats.sum([st[c.id], ...members.map(a => st[a.id])]);
      return { id: c.id, name: c.name, logo: c.page.profile.logo || '', members: members.length, views: t.views, taps: t.taps, clicks: t.clicks };
    }).sort((a, b) => b.views - a.views).slice(0, 5),
    recent,
  };
}

module.exports = {
  forEveryone(router) {
    router.get('/api/overview', async (req, res, { url }) => json(res, await overview(req._user, url.searchParams.get('tz'))));
    router.get('/api/system', async (req, res) => json(res, await system.get()));
  },
  forAdmins(router) {
    router.put('/api/system', async (req, res) => {
      const b = (await readJson(req, 3e6)) || {};
      json(res, await system.update({ name: b.name, logo: b.logo, accent: b.accent, accent2: b.accent2, sidebar: b.sidebar }));
    });
  },
  overview,
};
