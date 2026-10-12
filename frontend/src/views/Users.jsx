// "Users" screen (admins only): who can sign in, and what they can do.
//   Admin  – full access (create, edit, delete cards, manage users)
//   Viewer – can only look at statistics, for all cards or only the cards picked here
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext.js';
import { api, getJson, send } from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { navigate } from '../lib/router.js';
import { Icon } from '../components/Icon.jsx';
import { Dialog, showDialog, confirmDialog } from '../components/Dialog.jsx';
import { TopBar, Footer } from '../components/TopBar.jsx';

const ROLE = { admin: 'Admin', viewer: 'Viewer' };

function accessText(u, list) {
  if (u.role === 'admin') return 'Full access to everything';
  if (u.accounts === 'all') return 'Statistics of all cards';
  const names = u.accounts.map(id => (list.find(a => a.id === id) || {}).name).filter(Boolean);
  return names.length ? `Statistics of ${names.length} card${names.length > 1 ? 's' : ''}: ${names.join(', ')}` : 'No cards yet';
}

export function Users() {
  const { me } = useApp();
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const [users, list] = await Promise.all([getJson('/api/users'), getJson('/api/accounts')]);
    setData({ users, list });
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);

  const edit = async u => {
    const saved = await showDialog(close => <UserDialog user={u} list={data.list} onClose={close} />);
    if (!saved) return;
    toast(u ? 'User updated' : `User @${saved.username} added`);
    load();
  };
  const remove = async u => {
    if (!(await confirmDialog({ title: `Delete ${u.name}?`, text: `@${u.username} will no longer be able to sign in.`, confirm: 'Delete user' }))) return;
    const r = await api('/api/users/' + encodeURIComponent(u.username), 'DELETE');
    if (!r.ok) return toast((await r.json().catch(() => ({}))).message || 'Could not delete', { error: true });
    toast('User deleted');
    load();
  };

  return <>
    <TopBar />
    <main>
      <div className="hero">
        <button onClick={() => navigate('/')}><Icon k="back" size={14} /> Accounts</button>
        <h1 style={{ marginTop: 12 }}>Users</h1>
        <p>Admins can change everything. Viewers can only see statistics — nothing else.</p>
      </div>
      <button className="blk" style={{ maxWidth: 260 }} onClick={() => edit(null)} disabled={!data}>+ Add user</button>
      <div>
        {data && data.users.map(u => (
          <div key={u.username} className="usr">
            <div className="av">{(u.name || u.username)[0].toUpperCase()}</div>
            <div className="ai">
              <b>{u.name}</b> <span className={'role ' + u.role}>{ROLE[u.role]}</span>{u.username === me.username && <> <span className="tag">You</span></>}<br />
              <small>@{u.username}{u.builtin ? ' · set in server/.env' : ''}</small><br />
              <small>{accessText(u, data.list)}</small>
            </div>
            {!u.builtin && <>
              <button onClick={() => edit(u)}>Edit</button>
              {u.username !== me.username && <button title="Delete" onClick={() => remove(u)}><Icon k="trash" size={16} /></button>}
            </>}
          </div>
        ))}
      </div>
    </main>
    <Footer />
  </>;
}

function UserDialog({ user: u, list, onClose }) {
  const [name, setName] = useState(u ? u.name : '');
  const [username, setUsername] = useState(u ? u.username : '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(u ? u.role : 'viewer');
  const [scope, setScope] = useState(!u || u.accounts === 'all' ? 'all' : 'some');
  const [sel, setSel] = useState(u && Array.isArray(u.accounts) ? u.accounts : []);
  const userRef = useRef(null), passRef = useRef(null);

  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const submit = async () => {
    const accounts = scope === 'all' ? 'all' : sel.filter(id => list.some(a => a.id === id));
    if (role === 'viewer' && accounts !== 'all' && !accounts.length) throw new Error('Pick at least one card, or choose “All cards”.');
    const body = { name: name.trim(), role, accounts, password };
    if (!u) {
      body.username = username.trim().toLowerCase();
      if (!body.username) { userRef.current.focus(); throw new Error('Please enter a username.'); }
      if (password.length < 6) { passRef.current.focus(); throw new Error('The password needs at least 6 characters.'); }
    } else if (!password) delete body.password;
    return send(u ? '/api/users/' + encodeURIComponent(u.username) : '/api/users', u ? 'PUT' : 'POST', body, 'Could not save. Please try again.');
  };

  return (
    <Dialog icon="people" title={u ? `Edit ${u.name}` : 'Add a user'} text={u ? '' : 'They sign in at this same address with the username and password you set.'}
      confirm={u ? 'Save changes' : 'Add user'} onSubmit={submit} onClose={onClose}>
      <div className="fld"><label htmlFor="us-name">Name</label>
        <input id="us-name" maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sales team" autoComplete="off" /></div>
      <div className="fld"><label htmlFor="us-user">Username</label>
        <input id="us-user" ref={userRef} maxLength={32} value={username} onChange={e => setUsername(e.target.value)} disabled={!!u} placeholder="e.g. sales" autoComplete="off" spellCheck={false} /></div>
      <div className="fld"><label htmlFor="us-pass">{u ? 'New password' : 'Password'}</label>
        <input id="us-pass" ref={passRef} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={u ? 'Leave empty to keep the current one' : 'At least 6 characters'} /></div>
      <div className="fld"><label>Permission</label>
        <label className="opt"><input type="radio" name="role" checked={role === 'viewer'} onChange={() => setRole('viewer')} /><span><b>Viewer</b><small>Can only see statistics. Can’t create, edit or delete anything.</small></span></label>
        <label className="opt"><input type="radio" name="role" checked={role === 'admin'} onChange={() => setRole('admin')} /><span><b>Admin</b><small>Full access: cards, design, footer logo and users.</small></span></label>
      </div>
      {role === 'viewer' && (
        <div className="fld"><label>Statistics they can see</label>
          <label className="opt"><input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} /><span><b>All cards</b><small>Including cards added later.</small></span></label>
          <label className="opt"><input type="radio" name="scope" checked={scope === 'some'} onChange={() => setScope('some')} /><span><b>Only these cards</b></span></label>
          {scope === 'some' && (
            <div className="cks">
              {list.length ? list.map(a => (
                <label key={a.id} className="ck"><input type="checkbox" checked={sel.includes(a.id)} onChange={() => toggle(a.id)} /> {a.name || '(no name)'} <small>/{a.slug}</small></label>
              )) : <small className="dlg-hint">No cards yet.</small>}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function PasswordDialog({ onClose }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  return (
    <Dialog icon="profile" title="Change your password" confirm="Change password" onClose={onClose}
      onSubmit={() => send('/api/me/password', 'POST', { current: cur, next }, 'Could not change the password.').then(() => true)}>
      <div className="fld"><label htmlFor="pw-cur">Current password</label><input id="pw-cur" type="password" autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} /></div>
      <div className="fld"><label htmlFor="pw-new">New password</label><input id="pw-new" type="password" autoComplete="new-password" placeholder="At least 6 characters" value={next} onChange={e => setNext(e.target.value)} /></div>
    </Dialog>
  );
}

// Any signed-in user (except the .env admin) can change their own password.
export async function changePassword() {
  if (await showDialog(close => <PasswordDialog onClose={close} />)) toast('Password changed');
}
