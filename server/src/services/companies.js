// Companies: a company page at /<company>, a shared design and logo, a card template, and the people's cards
// at /<company>/<person>. Cards are made one by one or from an Excel sheet.
const accountsRepo = require('../repositories/accounts');
const companiesRepo = require('../repositories/companies');
const usersRepo = require('../repositories/users');
const events = require('../repositories/events');
const owners = require('./owners');
const pages = require('./pages');
const config = require('../config');
const xlsx = require('./xlsx');
const { NEUTRAL, FIELDS, rid, S, slugify, validSlug, newAccount, cleanFields, fieldKey } = require('./sanitize');

const clone = o => JSON.parse(JSON.stringify(o));
const LOGO = { logo: '', logoSize: 30, logoH: 40, logoZoom: 100, logoX: 0, logoY: 0, logoPos: 'tr', logoBg: true, logoBgColor: '#ffffff', logoRadius: 12, logoPad: 7, logoShadow: true };
const item = (ico, title, url) => ({ id: rid(), ico, icon: '', img: '', title, sub: '', url, off: false });

// The company page and card template a new company starts with.
function newCompany(name, slug) {
  return {
    id: rid(), slug, name, created: Date.now(), showTeam: true,
    theme: { ...NEUTRAL },
    page: {
      profile: { name, title: '', department: '', company: '', bio: '', photo: '', ...LOGO },
      fields: {},
      blocks: [
        { id: rid(), type: 'links', off: false, items: [
          item('globe', 'Visit our website', 'https://{website}'), item('phone', 'Call us', 'tel:{phone}'),
          item('mail', 'Email us', 'mailto:{email}'), item('pin', 'Find us', 'https://maps.google.com/?q={address}'),
        ] },
        { id: rid(), type: 'social', off: false, items: [] },
      ],
    },
    template: {
      profile: { name: 'Full Name', title: 'Job Title', department: '', company: name, bio: '', photo: '' },
      fields: { phone: '+251 911 000 000', email: 'name@company.com', whatsapp: '+251 911 000 000', website: 'www.company.com' },
      blocks: [
        { id: rid(), type: 'contact', off: false, label: 'Save My Contact', url: '', vcf: '', vcfName: '', auto: true },
        { id: rid(), type: 'links', off: false, items: [
          item('phone', 'Call me', 'tel:{phone}'), item('mail', 'Email me', 'mailto:{email}'),
          item('whatsapp', 'WhatsApp', 'https://wa.me/{whatsapp}'), item('linkedin', 'LinkedIn', 'https://linkedin.com/in/{linkedin}'),
          item('globe', 'Company website', 'https://{website}'),
        ] },
      ],
    },
  };
}

// A free top-level address for a company (not used by another company or an individual card).
async function freeCompanySlug(wanted) {
  let slug = slugify(wanted) || 'company';
  if (slug.length < 2) slug += '-co';
  const base = slug;
  for (let i = 2; !validSlug(slug) || !(await pages.topSlugFree(slug)); i++) slug = `${base}-${i}`;
  return slug;
}

// A free address for a card inside a company.
async function freeMemberSlug(companyId, wanted, taken = new Set()) {
  let slug = slugify(wanted) || 'card';
  if (slug.length < 2) slug += '-1';
  const base = slug;
  for (let i = 2; !validSlug(slug) || taken.has(slug) || (await accountsRepo.slugTaken(slug, null, companyId)); i++) slug = `${base}-${i}`;
  return slug;
}

async function create({ name, slug, login = true }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const c = newCompany(name, await freeCompanySlug(slug || name));
    try {
      await companiesRepo.insert(c);
      return { company: c, login: login ? await owners.createCompanyAdmin(c) : null };
    } catch (e) {
      if (!(e && e.code === 11000)) throw e;
    }
  }
  throw Object.assign(new Error('Could not find a free page address, try another one.'), { status: 409 });
}

// Copies the template's blocks with new ids, so every card can be changed on its own afterwards.
const copyBlocks = blocks => clone(blocks).map(b => ({ ...b, id: rid(), ...(b.items ? { items: b.items.map(i => ({ ...i, id: rid() })) } : {}) }));

// One person's card from the company template. row = { name, slug?, title, department, bio, fields: {…} }
async function addMember(c, row, { login = true, taken } = {}) {
  const tp = c.template.profile;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = await freeMemberSlug(c.id, row.slug || row.name, taken);
    const a = newAccount(S(row.name, 80).trim(), slug);
    Object.assign(a, { company: c.id, ownDesign: false, theme: clone(c.theme), fields: cleanFields(row.fields), blocks: copyBlocks(c.template.blocks) });
    Object.assign(a.profile, {
      title: S(row.title, 80).trim(), department: S(row.department, 80).trim() || tp.department || '',
      company: tp.company || c.name, bio: S(row.bio, 400).trim() || tp.bio || '',
    });
    try {
      await accountsRepo.insert(a);
      if (taken) taken.add(slug);
      return { account: a, login: login ? await owners.createFor(a, c) : null };
    } catch (e) {
      if (!(e && e.code === 11000)) throw e;
    }
  }
  throw new Error('Could not find a free page address');
}

/* ---------------- Excel ---------------- */

// Column headers people may use for each detail (compared without spaces, case or punctuation).
const ALIASES = {
  name: ['fullname', 'name', 'employeename', 'names', 'fullnames', 'employee'],
  slug: ['pageaddress', 'pageurl', 'address_url', 'slug', 'cardaddress', 'username'],
  title: ['jobtitle', 'title', 'position', 'role', 'designation'],
  department: ['department', 'dept', 'division', 'team', 'unit'],
  bio: ['bio', 'about', 'description', 'shortbio'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'tel', 'telephone', 'cell', 'cellphone'],
  email: ['email', 'emailaddress', 'mail', 'e_mail'],
  whatsapp: ['whatsapp', 'whatsappnumber'],
  website: ['website', 'web', 'site', 'websiteurl'],
  linkedin: ['linkedin', 'linkedinurl', 'linkedinprofile'],
  address: ['address', 'location', 'office', 'officeaddress'],
};
const norm = h => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const keyOf = h => {
  const n = norm(h);
  for (const [k, list] of Object.entries(ALIASES)) if (list.some(x => norm(x) === n)) return k;
  return fieldKey(h); // any other column: usable as {column_name} in links
};
const PROFILE_KEYS = ['name', 'slug', 'title', 'department', 'bio'];

// Turns the sheet's rows into card rows. Returns { rows: [{ line, name, slug, title, department, bio, fields }], error? }
function parseSheet(buf) {
  let rows;
  try { rows = xlsx.read(buf); } catch { return { error: 'That file could not be read. Save it as .xlsx (Excel) or .csv and try again.' }; }
  const hi = rows.findIndex(r => r.some(v => String(v).trim()));
  if (hi < 0) return { error: 'The sheet is empty.' };
  const keys = rows[hi].map(keyOf);
  if (!keys.includes('name')) return { error: 'No “Full name” column found. Use the Excel template: the first row must have the column names.' };
  const out = [];
  rows.slice(hi + 1).forEach((r, i) => {
    if (!r.some(v => String(v).trim())) return;
    const row = { line: hi + i + 2, fields: {} };
    keys.forEach((k, j) => {
      const v = String(r[j] ?? '').trim();
      if (!k || !v) return;
      if (PROFILE_KEYS.includes(k)) row[k] = v; else row.fields[k] = v;
    });
    out.push(row);
  });
  if (out.length > 1000) return { error: 'At most 1000 people per file. Split the sheet and import it in parts.' };
  return { rows: out };
}

// Creates a card (and sign-in) for every row. Rows without a name are skipped, and so are people who
// already have a card in this company with the same name and page address (importing the same file twice).
async function importSheet(c, buf, { login = true } = {}) {
  const parsed = parseSheet(buf);
  if (parsed.error) return parsed;
  const existing = await accountsRepo.listByCompany(c.id);
  const have = new Set(existing.map(a => `${a.profile.name.trim().toLowerCase()}|${a.slug}`));
  const taken = new Set(existing.map(a => a.slug));
  const created = [], skipped = [];
  for (const row of parsed.rows) {
    if (!row.name) { skipped.push({ line: row.line, reason: 'No full name' }); continue; }
    const want = slugify(row.slug || row.name);
    if (have.has(`${row.name.toLowerCase()}|${want}`)) { skipped.push({ line: row.line, name: row.name, reason: 'Already has a card in this company' }); continue; }
    const r = await addMember(c, row, { login, taken });
    created.push({ id: r.account.id, name: r.account.profile.name, slug: r.account.slug, ...(r.login || {}) });
  }
  return { created, skipped };
}

// Placeholders used in the company's card template that are not standard columns (e.g. {telegram}).
function extraPlaceholders(c) {
  const known = new Set([...Object.keys(ALIASES), 'company']);
  const found = new Set();
  const scan = s => { for (const m of String(s || '').matchAll(/\{\s*([a-z0-9_]+)\s*\}/gi)) if (!known.has(m[1].toLowerCase())) found.add(m[1].toLowerCase()); };
  for (const b of c.template.blocks) { scan(b.text); scan(b.label); for (const i of b.items || []) { scan(i.title); scan(i.url); scan(i.sub); } }
  return [...found];
}

// The Excel file to fill in: one row per person.
function templateFile(c) {
  const extra = extraPlaceholders(c);
  const head = ['Full name', 'Job title', 'Department', 'Phone', 'Email', 'WhatsApp', 'Website', 'LinkedIn', 'Address', 'Bio', 'Page address', ...extra];
  const help = [
    ['How to fill in the “People” sheet'],
    ['One row per person. Only “Full name” is required; leave any other cell empty if the person doesn’t have it.'],
    ['Phone / WhatsApp: write them with the country code, e.g. +251 911 223344. The cells are text, so a leading 0 or + is kept.'],
    ['Empty details are simply left off that person’s card (no WhatsApp button for someone without WhatsApp).'],
    ['Department and Bio: when empty, the defaults from the company card design are used.'],
    [`Page address: optional. Leave it empty to make it from the name, e.g. ${c.slug}/abebe-kebede.`],
    ['LinkedIn / Website: a full link (https://…) or just the address both work.'],
    extra.length ? [`Extra columns (${extra.join(', ')}) are used by links in the company card design.`] : [''],
    ['Don’t rename or remove the first row: it tells the system what each column is.'],
    ['Save as .xlsx (or .csv) and import it on the company page: Import from Excel.'],
  ];
  return xlsx.write([
    { name: 'People', rows: [head], widths: [24, 22, 18, 18, 26, 18, 22, 30, 26, 34, 20, ...extra.map(() => 18)], text: true },
    { name: 'How to fill', rows: help, widths: [120] },
  ]);
}

// Everyone's sign-in details for the company: send this file to the company.
async function signInsFile(c, base) {
  const [members, users] = await Promise.all([accountsRepo.listByCompany(c.id), usersRepo.list()]);
  const byOwner = Object.fromEntries(users.filter(u => u.owner).map(u => [u.owner, u]));
  const admin = users.find(u => u.company === c.id);
  const pw = u => (!u ? '' : u.mustChange ? config.defaultUserPassword : '');
  const status = u => (!u ? 'No sign-in' : u.mustChange ? 'Not signed in yet — must choose own password at first sign-in' : 'Has chosen own password (ask the admin to reset it if forgotten)');
  const rows = [['Name', 'Job title', 'Card link', 'NFC link (write this to the card)', 'Username', 'Temporary password', 'Status']];
  rows.push([`${c.name} — company admin (all cards’ statistics)`, '', `${base}/${c.slug}`, `${base}/n/${c.slug}`, admin ? admin.username : '', pw(admin), status(admin)]);
  for (const a of members) {
    const u = byOwner[a.id];
    rows.push([a.profile.name, a.profile.title, `${base}/${c.slug}/${a.slug}`, `${base}/n/${c.slug}/${a.slug}`, u ? u.username : '', pw(u), status(u)]);
  }
  const how = [
    ['How to sign in'],
    [`1. Open ${base}/admin`],
    ['2. Enter the username and temporary password from the “Sign-ins” sheet.'],
    ['3. Choose your own password. The temporary password stops working after that.'],
    ['Card owners see only their own card’s statistics. The company admin sees the totals of all cards and each person’s card.'],
  ];
  return xlsx.write([
    { name: 'Sign-ins', rows, widths: [34, 22, 40, 44, 28, 20, 60] },
    { name: 'How to sign in', rows: how, widths: [110] },
  ]);
}

// Deletes the company, all its cards, their statistics and sign-ins.
async function remove(c) {
  for (const a of await accountsRepo.listByCompany(c.id)) {
    await accountsRepo.remove(a.id);
    await events.removeFor(a.id);
    await usersRepo.removeOwnedBy(a.id);
  }
  await events.removeFor(c.id);
  await usersRepo.removeCompany(c.id);
  await companiesRepo.remove(c.id);
}

module.exports = { newCompany, create, addMember, importSheet, parseSheet, templateFile, signInsFile, remove, freeCompanySlug, freeMemberSlug, FIELDS };
