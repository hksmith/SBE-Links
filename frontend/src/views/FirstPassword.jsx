// Shown instead of the app when someone signed in with the generic first-time password:
// they have to choose their own password before they can see anything.
import { useState } from 'react';
import { send } from '../lib/api.js';
import { useApp } from '../AppContext.js';
import { Footer } from '../components/TopBar.jsx';
import { SystemLogo } from '../lib/theme.jsx';

export function FirstPassword() {
  const { me, system } = useApp();
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setErr('');
    if (next.length < 6) return setErr('Use at least 6 characters.');
    if (next !== again) return setErr('The two passwords are not the same.');
    setBusy(true);
    try {
      await send('/api/me/password', 'POST', { next }, 'Could not save your password. Please try again.');
      location.reload(); // signed in with the new password: open the app
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  };

  return <>
    <main style={{ maxWidth: 440 }}>
      <form className="first-pw" onSubmit={submit} onInput={() => setErr('')}>
        <div className="fp-brand"><SystemLogo system={system} size={34} /><b>{system.name}</b></div>
        <h1>Welcome{me.name && me.name !== me.username ? `, ${me.name}` : ''}</h1>
        <p>You signed in with a temporary password. Choose your own password to continue — you’ll use it from now on with the username <b>{me.username}</b>.</p>
        <div className="fld"><label htmlFor="fp-new">New password</label>
          <input id="fp-new" type="password" autoComplete="new-password" placeholder="At least 6 characters" autoFocus value={next} onChange={e => setNext(e.target.value)} /></div>
        <div className="fld"><label htmlFor="fp-again">Type it again</label>
          <input id="fp-again" type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} /></div>
        <div className="dlg-err" role="alert">{err}</div>
        <button className="pri blk" disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</button>
        <a href="/logout" className="first-pw-out">Log out</a>
      </form>
    </main>
    <Footer />
  </>;
}
