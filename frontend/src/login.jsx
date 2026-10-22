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
  useEffect(() => {
    fetch('/brand.json').then(r => r.json()).then(b => {
      setBrand(b);
      const s = b.system;
      if (!s) return;
      document.title = 'Sign in · ' + s.name;
      document.documentElement.style.setProperty('--a', s.accent);
      document.documentElement.style.setProperty('--b', s.accent2);
      if (s.logo) { const ic = document.querySelector('link[rel=icon]'); if (ic) { ic.removeAttribute('type'); ic.href = s.logo; } }
    }).catch(() => setBrand({ text: 'Powered by Shaggar BPO Enterprise' }));
  }, []);
  const sys = (brand && brand.system) || { name: 'SBPO Link Tree', logo: '' };

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
      <h1 className="lg-h">
        <i className={sys.logo ? 'has' : ''}>{sys.logo ? <img src={sys.logo} alt="" /> : (sys.name.trim()[0] || 'S').toUpperCase()}</i>
        <span>{brand ? sys.name : ''}</span>
      </h1>
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
