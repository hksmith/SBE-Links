// Session gate + routes. There is no separate /login route: when the server says 401 the login form
// is shown in place, so after signing in you land back on whatever page you were opening.
import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api, onSignedOut } from './api.js';
import { IconsContext } from './icons.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { ConfirmProvider } from './components/Dialog.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Editor from './pages/Editor.jsx';

export default function App() {
  const [auth, setAuth] = useState('loading'); // loading | in | out | error
  const [icons, setIcons] = useState({});

  // /api/icons doubles as the "am I signed in?" probe: it needs a session and every page needs the icons.
  const boot = useCallback(async () => {
    setAuth('loading');
    try { setIcons(await api('/api/icons')); setAuth('in'); }
    catch (e) { setAuth(e.status === 401 ? 'out' : 'error'); }
  }, []);

  useEffect(() => { boot(); return onSignedOut(() => setAuth('out')); }, [boot]);

  const logout = useCallback(async () => {
    try { await api('/logout', { method: 'POST' }); } catch { /* the probe below decides */ }
    boot();
  }, [boot]);

  if (auth === 'loading') return <div className="boot" role="status">Loading…</div>;
  if (auth === 'error') {
    return (
      <div className="boot">
        <div><b>Can’t reach the server.</b><p>Check that the server is running and that the address in <code>vercel.json</code> (or <code>VITE_API_URL</code>) is correct.</p><button className="pri" onClick={boot}>Try again</button></div>
      </div>
    );
  }
  if (auth === 'out') return <Login onSignedIn={boot} />;

  return (
    <IconsContext.Provider value={icons}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route path="/" element={<Dashboard onLogout={logout} />} />
            <Route path="/accounts/:id" element={<Editor />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </IconsContext.Provider>
  );
}
