// Sign-in page: posts credentials and opens the admin app on success.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { APP_URL } from './lib/api.js';
import './styles/login.css';

function Login() {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [brand, setBrand] = useState(null);
  useEffect(() => { fetch('/brand.json').then(r => r.json()).then(setBrand).catch(() => setBrand({ text: 'Powered by Shaggar BPO Enterprise' })); }, []);

  const submit = async e => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ u, p }) });
      if (r.ok) return void (location.href = APP_URL);
      setErr(r.status === 429 ? 'Too many tries, wait a few minutes' : 'Wrong username or password');
    } catch {
      setErr('Could not reach the server');
    }
    setBusy(false);
  };

  return (
    <form id="login-form" autoComplete="on" onSubmit={submit}>
      <h1>⚡ SBPO Link Tree</h1>
      <input name="username" placeholder="Username" autoComplete="username" required value={u} onChange={e => setU(e.target.value)} />
      <input name="password" type="password" placeholder="Password" autoComplete="current-password" required value={p} onChange={e => setP(e.target.value)} />
      <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <small role="alert">{err}</small>
      {brand && (brand.text || brand.logo) && (
        <div className="by">
          {brand.text && <span>{brand.text}</span>}
          {brand.logo && <img src={brand.logo} alt="" style={{ height: brand.logoSize, maxWidth: brand.logoSize * 5 }} />}
        </div>
      )}
    </form>
  );
}

createRoot(document.getElementById('login')).render(<Login />);
