// Dashboard: totals, account list, brand logo, and the "New account" dialog.
import { S } from '../state.js';
import { api, getJson } from '../api.js';
import { IC } from '../icons.js';
import { $, esc, O, ago, slugify } from '../utils.js';
import { openDialog, confirmDialog } from '../components/dialog.js';
import { toast } from '../components/toast.js';
import { edit } from './editor.js';

export async function dash() {
  S.cur = null;
  [S.list, S.brand] = await Promise.all([getJson('/api/accounts'), getJson('/api/brand').then(b => b.logo || '')]);
  const BR = S.brand;
  const T = S.list.reduce((a, x) => ({ t: a.t + x.taps, v: a.v + x.views, c: a.c + x.clicks }), { t: 0, v: 0, c: 0 });
  $('#app').innerHTML = `<header class="top"><span class="logo"><i class="${BR ? 'has' : ''}">${BR ? `<img src="${esc(BR)}" alt="">` : 'S'}</i>SBPO Link Tree</span><span class="sp"></span><button class="pri" data-a="new">+ New account</button><a href="/logout"><button>Log out</button></a></header><main>
 <div class="hero"><h1>NFC business cards</h1><p>One account per person. Copy the NFC link, write it to the card, and watch the taps come in.</p></div>
 <div class="stats"><div class="st"><small>Accounts</small><div>${S.list.length}</div></div><div class="st"><small>NFC taps</small><div>${T.t}</div></div><div class="st"><small>Page views</small><div>${T.v}</div></div><div class="st"><small>Link clicks</small><div>${T.c}</div></div></div>
 <input id="q" placeholder="Search accounts…" style="margin-bottom:12px"><div id="al"></div>
 <div class="card"><h2>Footer logo</h2><div class="row"><div class="bl">${BR ? `<img src="${esc(BR)}" alt="">` : '<small style="color:var(--mut)">No logo</small>'}</div><div style="flex:1"><small class="hint">Shows next to “Powered by Shaggar BPO Enterprise” at the bottom of every page, and in this header.</small><button data-up="brand">${IC('upload', 14)} Upload logo</button>${BR ? ' <button data-a="rmbrand">Remove</button>' : ''}</div></div></div></main>
 <div class="ft">Powered by Shaggar BPO Enterprise${BR ? `<img src="${esc(BR)}" alt="">` : ''}</div>`;
  rows('');
}

export function rows(f) {
  f = f.toLowerCase();
  $('#al').innerHTML = S.list.filter(a => (a.name + a.slug + a.title + a.company).toLowerCase().includes(f)).map(a => `<div class="acc" data-e="${a.id}">
 ${a.photo ? `<img class="av" src="${esc(a.photo)}" alt="">` : `<div class="av">${esc((a.name || '?')[0]).toUpperCase()}</div>`}
 <div class="ai"><b>${esc(a.name) || '(no name)'}</b><small>${esc([a.title, a.company].filter(Boolean).join(' · ')) || 'No title yet'}</small><br><small>/${esc(a.slug)} · last tap ${ago(a.last)}</small></div>
 <div class="nums"><div><b>${a.taps}</b><small>NFC taps</small></div><div><b>${a.views}</b><small>Views</small></div><div><b>${a.clicks}</b><small>Clicks</small></div></div>
 <button data-cp="${O}/n/${esc(a.slug)}">Copy NFC link</button><button data-a="del" data-id="${a.id}" data-name="${esc(a.name)}" title="Delete">${IC('trash', 16)}</button></div>`).join('')
    || `<p style="color:var(--mut)">${f ? 'No accounts match your search.' : 'No accounts yet. Click “+ New account”.'}</p>`;
}

export async function newAccount() {
  const host = O.replace(/^https?:\/\//, '') + '/';
  const account = await openDialog({
    icon: 'profile',
    title: 'Create a new account',
    text: 'One account per person. You can change everything else later.',
    confirm: 'Create account',
    body: `<div class="fld"><label for="na-name">Full name</label><input id="na-name" name="name" maxlength="80" placeholder="e.g. Yiha Yimam" autocomplete="off" required></div>
      <div class="fld"><label for="na-slug">Page address</label><div class="dlg-url"><span>${esc(host)}</span><input id="na-slug" name="slug" maxlength="40" placeholder="yiha-yimam" autocomplete="off" spellcheck="false"></div>
      <small class="dlg-hint">Filled in from the name. Don’t change it after programming the NFC card.</small></div>`,
    onOpen(form) {
      const name = form.querySelector('#na-name'), slug = form.querySelector('#na-slug');
      let touched = false;
      name.addEventListener('input', () => { if (!touched) slug.value = slugify(name.value); });
      slug.addEventListener('input', () => { touched = !!slug.value; });
      slug.addEventListener('blur', () => { slug.value = slugify(slug.value); });
    },
    async onSubmit(form) {
      const name = form.querySelector('#na-name').value.trim();
      const slug = slugify(form.querySelector('#na-slug').value);
      if (!name) { form.querySelector('#na-name').focus(); throw new Error('Please enter a name.'); }
      if (slug && slug.length < 2) throw new Error('The page address needs at least 2 characters.');
      const r = await api('/api/accounts', 'POST', { name, slug: slug || undefined });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || 'Could not create the account. Please try again.');
      return j;
    },
  });
  if (!account) return;
  toast(account.slug === slugify(account.profile.name) ? 'Account created' : `Account created at /${account.slug}`);
  edit(account.id);
}

export async function deleteAccount(id, name) {
  const ok = await confirmDialog({
    title: `Delete ${name || 'this account'}?`,
    text: 'This removes the page and all its stats. The NFC link on the card will stop working.',
    confirm: 'Delete account',
  });
  if (!ok) return;
  await api('/api/accounts/' + id, 'DELETE');
  toast('Account deleted');
  dash();
}
