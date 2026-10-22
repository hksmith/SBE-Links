// The admin layout: a sidebar (system logo + name, the screens the signed-in user may open, their account)
// and the content column (each screen's header, the screen, the footer).
import { useEffect, useState } from 'react';
import { useApp } from '../AppContext.js';
import { navigate, useRoute } from '../lib/router.js';
import { SystemLogo } from '../lib/theme.jsx';
import { Icon } from './Icon.jsx';
import { LiveBadge } from './Live.jsx';
import { changePassword } from '../views/Users.jsx';

const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};

// Which sidebar entries each kind of user gets. `on` = the screens (route names) that light the entry up.
function navFor(me, isAdmin) {
  if (isAdmin) return [
    { to: '/', label: 'Dashboard', icon: 'grid', on: [''] },
    { to: '/cards', label: 'Cards', icon: 'card', on: ['cards', 'edit', 'stats'] },
    { to: '/companies', label: 'Companies', icon: 'building', on: ['companies', 'company', 'cpage', 'ctpl'] },
    { to: '/qr', label: 'QR codes', icon: 'qr', on: ['qr'] },
    { sep: 'Administration' },
    { to: '/users', label: 'Users', icon: 'people', on: ['users'] },
    { to: '/settings', label: 'Settings', icon: 'sliders', on: ['settings'] },
  ];
  if (me.company) return [
    { to: '/', label: 'Dashboard', icon: 'grid', on: [''] },
    { to: '/company/' + me.company, label: 'Our company', icon: 'building', on: ['company', 'stats'] },
  ];
  return [
    { to: '/', label: 'Dashboard', icon: 'grid', on: [''] },
    { to: '/cards', label: 'Cards', icon: 'card', on: ['cards', 'stats'] },
  ];
}

export function Layout({ children }) {
  const { me, isAdmin, system } = useApp();
  const route = useRoute();
  const [open, setOpen] = useState(false); // phone: sidebar slid in
  const [mini, setMini] = useState(() => store.get('sidebar-mini') === '1'); // desktop: icons only
  useEffect(() => { setOpen(false); }, [route.name, route.id]);
  const toggleMini = () => setMini(m => { store.set('sidebar-mini', m ? '0' : '1'); return !m; });

  const role = me.role === 'admin' ? 'Admin' : me.company ? 'Company' : 'Viewer';
  return (
    <div className={'shell' + (mini ? ' mini' : '') + (open ? ' open' : '')}>
      <aside className="side" aria-label="Main menu">
        <a className="brand" href="#/" title={`${system.name} — Dashboard`} onClick={() => setOpen(false)}>
          <SystemLogo system={system} size={38} />
          <b>{system.name}</b>
        </a>
        <nav>
          {navFor(me, isAdmin).map((n, i) => n.sep
            ? <small key={i} className="nav-sep">{n.sep}</small>
            : <a key={n.to} href={'#' + n.to} className={n.on.includes(route.name) ? 'on' : ''} title={mini ? n.label : undefined}>
              <Icon k={n.icon} size={18} /><span>{n.label}</span>
            </a>)}
        </nav>
        <span className="sp" />
        <div className="who">
          <span className="av">{(me.name || me.username)[0].toUpperCase()}</span>
          <div><b>{me.name}</b><small>{role}</small></div>
        </div>
        <div className="side-acts">
          {!me.builtin && <button onClick={changePassword} title="Change password"><Icon k="key" size={16} /><span>Password</span></button>}
          <a href="/logout"><button title="Log out"><Icon k="logout" size={16} /><span>Log out</span></button></a>
          <button className="mini-tg" onClick={toggleMini} title={mini ? 'Show the menu' : 'Make the menu narrow'} aria-label="Collapse menu"><Icon k="sidebar" size={16} /></button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="content">
        <div className="mbar">
          <button onClick={() => setOpen(true)} aria-label="Open menu"><Icon k="menu" size={18} /></button>
          <a className="brand" href="#/"><SystemLogo system={system} size={30} /><b>{system.name}</b></a>
        </div>
        {children}
        <Footer />
      </div>
    </div>
  );
}

// Each screen's header: optional back button, title, actions, and the "Live" badge on statistics screens.
export function PageHeader({ title, sub, back, live, children }) {
  return (
    <header className="top">
      {back && <button onClick={() => navigate(back[0])}><Icon k="back" size={14} /> {back[1]}</button>}
      <div className="ph-t"><h1>{title}</h1>{sub && <small>{sub}</small>}</div>
      <span className="sp" />
      {live !== undefined && <LiveBadge updated={live} />}
      {children}
    </header>
  );
}

// The footer statement + logo ("Powered by Shaggar BPO Enterprise" by default), set under Settings.
export function BrandLine({ text, logo, size = 18 }) {
  if (!text && !logo) return null;
  return <>
    {text && <span>{text}</span>}
    {logo && <img src={logo} alt="" style={{ height: size, maxWidth: size * 5 }} />}
  </>;
}

export function Footer() {
  const { brand } = useApp();
  return <div className="ft"><BrandLine text={brand.text} logo={brand.logo} size={brand.logoSize} /></div>;
}
