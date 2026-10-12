// Admin app root: loads the signed-in user + icon set, then shows the screen for the current #route.
import { useEffect, useMemo, useState } from 'react';
import { AppContext } from './AppContext.js';
import { getJson } from './lib/api.js';
import { loadIcons } from './lib/icons.js';
import { useRoute, navigate } from './lib/router.js';
import { Toasts } from './components/Toasts.jsx';
import { DialogHost } from './components/Dialog.jsx';
import { Dashboard } from './views/Dashboard.jsx';
import { Users } from './views/Users.jsx';
import { StatsView } from './views/StatsView.jsx';
import { Editor } from './editor/Editor.jsx';
import { FirstPassword } from './views/FirstPassword.jsx';
import { CompanyView } from './views/CompanyView.jsx';

const EMPTY_BRAND = { logo: '', logoSize: 18, text: '' };

export default function App() {
  const [me, setMe] = useState(null);
  const [brand, setBrand] = useState(EMPTY_BRAND);
  const [failed, setFailed] = useState(false);
  const route = useRoute();

  useEffect(() => {
    Promise.all([getJson('/api/me'), getJson('/api/icons').then(loadIcons), getJson('/api/brand').catch(() => EMPTY_BRAND)])
      .then(([m, , b]) => { setMe(m); setBrand({ ...EMPTY_BRAND, ...b }); document.body.classList.toggle('viewer', m.role !== 'admin'); })
      .catch(() => setFailed(true));
  }, []);

  const isAdmin = !!me && me.role === 'admin';
  const ctx = useMemo(() => ({ me, isAdmin, brand, setBrand }), [me, isAdmin, brand]);

  // Keep people on screens their role allows.
  let { name, id } = route;
  if (me && !isAdmin && ['edit', 'users', 'cpage', 'ctpl'].includes(name)) { name = name === 'edit' && id ? 'stats' : ''; }
  useEffect(() => {
    if (me && name !== route.name) navigate(name ? `/${name}/${id ?? ''}` : '/');
  }, [me, name, route.name, id]);

  let screen = null;
  if (failed) screen = <main><p style={{ color: 'var(--mut)' }}>Could not load the admin app. Check that the server is running, then reload.</p></main>;
  else if (me) {
    if (me.mustChange) screen = <FirstPassword />;
    else if (name === 'users') screen = <Users />;
    else if (name === 'edit' && id) screen = <Editor key={id} id={id} />;
    else if (name === 'cpage' && id) screen = <Editor key={'p' + id} id={id} kind="page" />;
    else if (name === 'ctpl' && id) screen = <Editor key={'t' + id} id={id} kind="template" />;
    else if (name === 'company' && id) screen = <CompanyView key={id} id={id} />;
    else if (name === 'stats' && id) screen = <StatsView key={id} id={id} />;
    else if (!isAdmin && me.company) screen = <CompanyView key={me.company} id={me.company} />; // company admin's home
    else screen = <Dashboard />;
  }

  return (
    <AppContext.Provider value={ctx}>
      {screen}
      <Toasts />
      <DialogHost />
    </AppContext.Provider>
  );
}
