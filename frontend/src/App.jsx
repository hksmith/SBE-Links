// Admin app root: loads the signed-in user, icon set, branding and system settings,
// then shows the screen for the current #route inside the sidebar layout.
import { useEffect, useMemo, useState } from 'react';
import { AppContext } from './AppContext.js';
import { getJson } from './lib/api.js';
import { loadIcons } from './lib/icons.js';
import { useRoute, navigate } from './lib/router.js';
import { DEFAULT_SYSTEM, applyTheme } from './lib/theme.jsx';
import { Toasts } from './components/Toasts.jsx';
import { DialogHost } from './components/Dialog.jsx';
import { Layout } from './components/TopBar.jsx';
import { Home } from './views/Home.jsx';
import { Cards } from './views/Cards.jsx';
import { Companies } from './views/Companies.jsx';
import { Users } from './views/Users.jsx';
import { Settings } from './views/Settings.jsx';
import { StatsView } from './views/StatsView.jsx';
import { Editor } from './editor/Editor.jsx';
import { FirstPassword } from './views/FirstPassword.jsx';
import { CompanyView } from './views/CompanyView.jsx';
import { QrCodes } from './views/QrCodes.jsx';
import { QrDetail } from './views/QrDetail.jsx';

const EMPTY_BRAND = { logo: '', logoSize: 18, text: '' };
const ADMIN_ONLY = ['edit', 'users', 'cpage', 'ctpl', 'qr', 'settings', 'companies'];

export default function App() {
  const [me, setMe] = useState(null);
  const [brand, setBrand] = useState(EMPTY_BRAND);
  const [system, setSystemState] = useState(DEFAULT_SYSTEM);
  const [failed, setFailed] = useState(false);
  const route = useRoute();

  const setSystem = s => { const next = { ...DEFAULT_SYSTEM, ...s }; applyTheme(next); setSystemState(next); };

  useEffect(() => {
    applyTheme(DEFAULT_SYSTEM);
    Promise.all([getJson('/api/me'), getJson('/api/icons').then(loadIcons), getJson('/api/brand').catch(() => EMPTY_BRAND), getJson('/api/system').catch(() => DEFAULT_SYSTEM)])
      .then(([m, , b, s]) => { setMe(m); setBrand({ ...EMPTY_BRAND, ...b }); setSystem(s); document.body.classList.toggle('viewer', m.role !== 'admin'); })
      .catch(() => setFailed(true));
  }, []);

  const isAdmin = !!me && me.role === 'admin';
  const ctx = useMemo(() => ({ me, isAdmin, brand, setBrand, system, setSystem }), [me, isAdmin, brand, system]);

  // Keep people on screens their role allows.
  let { name, id } = route;
  if (me && !isAdmin && ADMIN_ONLY.includes(name)) { name = name === 'edit' && id ? 'stats' : ''; }
  useEffect(() => {
    if (me && name !== route.name) navigate(name ? `/${name}/${id ?? ''}` : '/');
  }, [me, name, route.name, id]);

  let screen = null;
  if (failed) screen = <main><p style={{ color: 'var(--mut)' }}>Could not load the admin app. Check that the server is running, then reload.</p></main>;
  else if (me && me.mustChange) screen = <FirstPassword />;
  else if (me) {
    let page;
    if (name === 'users') page = <Users />;
    else if (name === 'settings') page = <Settings />;
    else if (name === 'cards') page = <Cards />;
    else if (name === 'companies') page = <Companies />;
    else if (name === 'qr') page = id ? <QrDetail key={id} id={id} /> : <QrCodes />;
    else if (name === 'edit' && id) page = <Editor key={id} id={id} />;
    else if (name === 'cpage' && id) page = <Editor key={'p' + id} id={id} kind="page" />;
    else if (name === 'ctpl' && id) page = <Editor key={'t' + id} id={id} kind="template" />;
    else if (name === 'company' && id) page = <CompanyView key={id} id={id} />;
    else if (name === 'stats' && id) page = <StatsView key={id} id={id} />;
    else page = <Home />;
    screen = <Layout>{page}</Layout>;
  }

  return (
    <AppContext.Provider value={ctx}>
      {screen}
      <Toasts />
      <DialogHost />
    </AppContext.Provider>
  );
}
