// "New account" dialog and account deletion; used from the top bar and the dashboard.
import { useRef, useState } from 'react';
import { send, api } from '../lib/api.js';
import { O, slugify } from '../lib/utils.js';
import { toast } from '../lib/toast.js';
import { navigate } from '../lib/router.js';
import { Dialog, showDialog, confirmDialog } from '../components/Dialog.jsx';

function NewAccountDialog({ onClose }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const touched = useRef(false), nameRef = useRef(null);
  const host = O.replace(/^https?:\/\//, '') + '/';

  const submit = async () => {
    const n = name.trim(), s = slugify(slug);
    if (!n) { nameRef.current.focus(); throw new Error('Please enter a name.'); }
    if (s && s.length < 2) throw new Error('The page address needs at least 2 characters.');
    return send('/api/accounts', 'POST', { name: n, slug: s || undefined }, 'Could not create the account. Please try again.');
  };

  return (
    <Dialog icon="profile" title="Create a new account" text="One account per person. You can change everything else later." confirm="Create account" onSubmit={submit} onClose={onClose}>
      <div className="fld">
        <label htmlFor="na-name">Full name</label>
        <input id="na-name" ref={nameRef} maxLength={80} placeholder="e.g. Yiha Yimam" autoComplete="off" required value={name}
          onChange={e => { setName(e.target.value); if (!touched.current) setSlug(slugify(e.target.value)); }} />
      </div>
      <div className="fld">
        <label htmlFor="na-slug">Page address</label>
        <div className="dlg-url">
          <span>{host}</span>
          <input id="na-slug" maxLength={40} placeholder="yiha-yimam" autoComplete="off" spellCheck={false} value={slug}
            onChange={e => { setSlug(e.target.value); touched.current = !!e.target.value; }}
            onBlur={() => setSlug(s => slugify(s))} />
        </div>
        <small className="dlg-hint">Filled in from the name. Don’t change it after programming the NFC card.</small>
      </div>
    </Dialog>
  );
}

export async function newAccount() {
  const account = await showDialog(close => <NewAccountDialog onClose={close} />);
  if (!account) return;
  toast(account.slug === slugify(account.profile.name) ? 'Account created' : `Account created at /${account.slug}`);
  navigate('/edit/' + account.id);
}

// Resolves true when the account was deleted.
export async function deleteAccount(a) {
  const ok = await confirmDialog({
    title: `Delete ${a.name || 'this account'}?`,
    text: 'This removes the page and all its stats. The NFC link on the card will stop working.',
    confirm: 'Delete account',
  });
  if (!ok) return false;
  const r = await api('/api/accounts/' + a.id, 'DELETE');
  if (!r.ok) { toast('Could not delete the account', { error: true }); return false; }
  toast('Account deleted');
  return true;
}
