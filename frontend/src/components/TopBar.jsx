// Top bar shared by the dashboard and the Users screen. What it offers depends on the signed-in user's role.
import { useApp } from '../AppContext.js';
import { navigate } from '../lib/router.js';
import { Icon } from './Icon.jsx';
import { Menu } from './Menu.jsx';
import { newAccount } from '../views/accountActions.jsx';
import { newCompany } from '../views/companyActions.jsx';
import { changePassword } from '../views/Users.jsx';

export function TopBar() {
  const { me, isAdmin, brand } = useApp();
  return (
    <header className="top">
      <span className="logo"><i className={brand.logo ? 'has' : ''}>{brand.logo ? <img src={brand.logo} alt="" /> : 'S'}</i>SBPO Link Tree</span>
      <span className="sp" />
      {isAdmin && <>
        <button onClick={() => navigate('/qr')}><Icon k="qr" size={14} /> QR codes</button>
        <button onClick={() => navigate('/users')}><Icon k="people" size={14} /> Users</button>
        <button onClick={newCompany}><Icon k="building" size={14} /> New company</button>
        <button className="pri" onClick={newAccount}>+ New account</button>
      </>}
      <Menu className="me" label="Account menu" summary={<>
        <span className="who">{me.name}</span>
        <span className={'role ' + me.role}>{me.role === 'admin' ? 'Admin' : me.company ? 'Company' : 'Viewer'}</span>
      </>}>
        {!me.builtin && <button onClick={changePassword}>Change password</button>}
        <a href="/logout"><button>Log out</button></a>
      </Menu>
    </header>
  );
}

// The footer statement + logo ("Powered by Shaggar BPO Enterprise" by default), editable on the dashboard.
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
