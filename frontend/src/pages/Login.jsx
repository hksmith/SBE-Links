import { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onSignedIn }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await api('/login', { method: 'POST', body: { u, p } });
      onSignedIn();
    } catch (x) {
      setErr(x.status === 429 ? 'Too many tries, wait a few minutes.' : x.status === 401 ? 'Wrong username or password.' : x.status === 0 ? x.message : 'Could not sign in. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1><span className="mark">S</span>SBPO Link Tree</h1>
        <p>Sign in to manage your NFC cards.</p>
        <input name="username" placeholder="Username" autoComplete="username" required autoFocus value={u} onChange={e => setU(e.target.value)} />
        <input name="password" type="password" placeholder="Password" autoComplete="current-password" required value={p} onChange={e => setP(e.target.value)} />
        <button className="pri" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <small role="alert">{err}</small>
        <div className="by">Powered by Shaggar BPO Enterprise</div>
      </form>
    </div>
  );
}
