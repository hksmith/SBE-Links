// "New account" dialog and account deletion; used from the top bar and the dashboard.
import { useRef, useState } from 'react';
import { send, api } from '../lib/api.js';
import { O, slugify } from '../lib/utils.js';
import { toast } from '../lib/toast.js';
import { navigate } from '../lib/router.js';
import { Dialog, showDialog, confirmDialog } from '../components/Dialog.jsx';
import { showLoginDetails } from './loginDetails.jsx';

function NewAccountDialog({ onClose }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [login, setLogin] = useState(true);
  const touched = useRef(false), nameRef = useRef(null);
  const host = O.replace(/^https?:\/\//, '') + '/';

  const submit = async () => {
    const n = name.trim(), s = slugify(slug);
    if (!n) { nameRef.current.focus(); throw new Error('Please enter a name.'); }
    if (s && s.length < 2) throw new Error('The page address needs at least 2 characters.');
    return send('/api/accounts', 'POST', { name: n, slug: s || undefined, login }, 'Could not create the account. Please try again.');
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
      <div className="fld">
        <label className="opt"><input type="checkbox" checked={login} onChange={e => setLogin(e.target.checked)} />
          <span><b>Let them see their own statistics</b><small>Creates a view-only sign-in for this card with the standard first-time password. They choose their own password the first time they sign in.</small></span></label>
      </div>
    </Dialog>
  );
}

export async function newAccount() {
  const account = await showDialog(close => <NewAccountDialog onClose={close} />);
  if (!account) return;
  toast(account.slug === slugify(account.profile.name) ? 'Account created' : `Account created at /${account.slug}`);
  navigate('/edit/' + account.id);
  if (account.login === undefined) toast('No sign-in was created: the server is running an older version. Redeploy the server.', { error: true, ms: 8000 });
  if (account.login) showLoginDetails('Their sign-in details', 'Send this to the card owner so they can see their statistics.', [{ name: account.profile.name, ...account.login }]);
}

// Resolves true when the account was deleted.
export async function deleteAccount(a) {
  const ok = await confirmDialog({
    title: `Delete ${a.name || 'this account'}?`,
    text: 'This removes the page, all its stats and the owner’s sign-in. The NFC link on the card will stop working.',
    confirm: 'Delete account',
  });
  if (!ok) return false;
  const r = await api('/api/accounts/' + a.id, 'DELETE');
  if (!r.ok) { toast('Could not delete the account', { error: true }); return false; }
  toast('Account deleted');
  return true;
}

// Statistics of one card back to zero (the card, its links and NFC link keep working). Resolves true when done.
export async function resetCardStats(a) {
  const n = (a.views || 0) + (a.clicks || 0);
  const ok = await confirmDialog({
    title: `Reset ${a.name || 'this card'}’s statistics?`,
    text: `All recorded ${n ? `${n} ` : ''}views, NFC taps and clicks of this card are deleted and counting starts again from zero. The card itself is not changed. This can’t be undone.`,
    confirm: 'Reset statistics', icon: 'graph',
  });
  if (!ok) return false;
  try {
    await send(`/api/accounts/${a.id}/reset-stats`, 'POST', undefined, 'Could not reset the statistics');
    toast('Statistics reset');
    return true;
  } catch (e) { toast(e.message, { error: true }); return false; }
}
