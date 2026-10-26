// What a page actually shows, after applying the company:
//   - a company card uses the company's design (theme) unless it has its own (ownDesign),
//   - and always the company logo (set on the company page; a card can't change it),
//   - {placeholders} in links and texts are filled in with the person's details (fields + profile).
// Also: page addresses (/<slug> or /<company>/<slug>) and the company page itself.
const accounts = require('../repositories/accounts');
const companies = require('../repositories/companies');

const LOGO_KEYS = ['logo', 'logoSize', 'logoH', 'logoZoom', 'logoX', 'logoY', 'logoPos', 'logoBg', 'logoBgColor', 'logoRadius', 'logoPad', 'logoShadow'];
// How the logo looks on the cards (size, crop, position) is set in the card design; the logo image itself on the company page.
const LOGO_LOOK = LOGO_KEYS.filter(k => k !== 'logo');
const PH = /\{\s*([a-z0-9_]+)\s*\}/gi;

// The company's design and logo applied to a card (or to the company's card template).
function inherit(a, company) {
  if (!company) return a;
  const lp = company.page.profile, tp = (company.template && company.template.profile) || {};
  const profile = { ...a.profile, logo: lp.logo };
  for (const k of LOGO_LOOK) profile[k] = tp[k] ?? lp[k]; // older companies kept these on the company page
  if (!profile.company) profile.company = company.name;
  return { ...a, theme: a.ownDesign ? a.theme : company.theme, profile };
}

// Values for {placeholders}: the person's details plus {name}, {title}, {department}, {company}.
const varsOf = doc => {
  const p = doc.profile || {};
  return { name: p.name, title: p.title, department: p.department, company: p.company, ...(doc.fields || {}) };
};

// Fills placeholders in one string. `kind` = 'url' tidies values for links. Returns null when a placeholder is empty.
function fill(str, vars, kind) {
  if (!str || !/\{\s*[a-z0-9_]+\s*\}/i.test(str)) return str;
  let empty = false, full = null;
  const s = str.replace(PH, (_, k) => {
    let v = String(vars[k.toLowerCase()] ?? '').trim();
    if (!v) { empty = true; return ''; }
    if (kind === 'url') {
      if (/^https?:\/\//i.test(v)) { full = v; return v; } // a full link in the cell is used as the whole link
      if (/^tel:/i.test(str)) v = v.replace(/[^\d+]/g, '');
      else if (/wa\.me\//i.test(str)) v = v.replace(/\D/g, '');
      else v = v.replace(/\s/g, mailto(str) ? '' : '%20');
    }
    return v;
  });
  if (empty) return null;
  return kind === 'url' && full ? full : s;
}
const mailto = s => /^mailto:/i.test(s);

// Blocks with placeholders filled in. A link whose placeholder has no value is left out (a person without
// WhatsApp gets no WhatsApp button); so is a text block.
function resolveBlocks(blocks, vars) {
  const out = [];
  for (const b of blocks || []) {
    if (b.items) {
      const items = [];
      for (const i of b.items) {
        const title = fill(i.title, vars), sub = fill(i.sub, vars), url = fill(i.url, vars, 'url');
        if (title === null || url === null) continue;
        items.push({ ...i, title, sub: sub ?? '', url });
      }
      out.push({ ...b, items });
    } else if (b.type === 'text') {
      const text = fill(b.text, vars);
      if (text !== null) out.push({ ...b, text });
    } else if (b.type === 'contact') {
      out.push({ ...b, label: fill(b.label, vars) || 'Save My Contact' });
    } else out.push(b);
  }
  return out;
}

// The card exactly as visitors see it.
const forDisplay = (a, company) => {
  const e = inherit(a, company);
  return { ...e, blocks: resolveBlocks(e.blocks, varsOf(e)) };
};

// The company page as an account-shaped document, so the same page renderer is used.
// It uses the company design (shared with the cards) unless it was given its own (pageOwnDesign).
const companyDoc = c => ({
  id: c.id, slug: c.slug, created: c.created, company: null, isCompany: true, ownDesign: !!(c.pageOwnDesign && c.pageTheme),
  profile: { ...c.page.profile, name: c.page.profile.name || c.name, photo: '' },
  fields: c.page.fields || {}, theme: c.pageOwnDesign && c.pageTheme ? c.pageTheme : c.theme, blocks: c.page.blocks,
});
const companyForDisplay = c => {
  const d = companyDoc(c);
  return { ...d, blocks: resolveBlocks(d.blocks, varsOf(d)) };
};

// "slug" or "company-slug/slug"
const pathOf = (a, company) => (a.company && company ? `${company.slug}/${a.slug}` : a.slug);
async function pathFor(a) {
  if (!a.company) return a.slug;
  const c = await companies.get(a.company);
  return c ? `${c.slug}/${a.slug}` : a.slug;
}

// A card or a company page by id, ready to display: { doc, path } or null. Used by /go and /vcf.
async function byId(id) {
  const a = await accounts.get(id);
  if (a) {
    const c = a.company ? await companies.get(a.company) : null;
    return { doc: forDisplay(a, c), path: pathOf(a, c), account: a };
  }
  const c = await companies.get(id);
  return c ? { doc: companyForDisplay(c), path: c.slug, company: c } : null;
}

// Is a top-level address free for a new individual card or company?
async function topSlugFree(slug, except) {
  return !(await accounts.slugTaken(slug, except)) && !(await companies.slugTaken(slug, except));
}

module.exports = { inherit, resolveBlocks, fill, varsOf, forDisplay, companyDoc, companyForDisplay, pathOf, pathFor, byId, topSlugFree, LOGO_KEYS, LOGO_LOOK };
