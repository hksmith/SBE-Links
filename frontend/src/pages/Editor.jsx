// Account editor: header bar, three tabs (Link in Bio / Design / Analytics) and the live phone preview.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { uploadImage } from '../api.js';
import { PUBLIC_HOST, nfcUrl, pageUrl } from '../config.js';
import { Icon } from '../icons.jsx';
import { useConfirm } from '../components/Dialog.jsx';
import { useToast } from '../components/Toast.jsx';
import { copyText } from '../clipboard.js';
import { useAccountEditor } from '../hooks/useAccountEditor.js';
import { imageSize, toData } from '../utils.js';
import BioTab from './editor/BioTab.jsx';
import DesignTab from './editor/DesignTab.jsx';
import StatsTab from './editor/StatsTab.jsx';
import Preview from './editor/Preview.jsx';

const TABS = [['bio', 'Link in Bio'], ['design', 'Design'], ['stats', 'Analytics']];
const STATUS = { saved: 'Saved ✓', dirty: 'Unsaved…', saving: 'Saving…', failed: 'Save failed' };

export default function Editor() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const editor = useAccountEditor(id);
  const { account, update, save, undo, canUndo, canRedo, status, loadError, refreshStats } = editor;

  const [tab, setTab] = useState('bio');
  const [open, setOpen] = useState(null);       // expanded block id ("hdr" = header)
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const target = useRef(null);

  useEffect(() => { if (tab === 'stats') refreshStats().catch(() => {}); }, [tab, refreshStats]);

  // Opens the hidden file picker; `t` says what the chosen image(s) are for.
  const pickFile = (t, multiple = false) => {
    target.current = t;
    fileRef.current.multiple = multiple;
    fileRef.current.click();
  };

  async function onFiles(e) {
    const files = [...e.target.files], t = target.current;
    e.target.value = '';
    if (!files.length || !t) return;
    setUploading(true);
    try {
      if (t === 'bg') {
        const url = await uploadImage(await toData(files[0], 1200, 'image/jpeg'));
        update(a => { a.theme.bgImage = url; });
      } else if (t === 'photo') {
        const url = await uploadImage(await toData(files[0], 900, 'image/jpeg'));
        update(a => { a.profile.photo = url; });
      } else if (t === 'logo') {
        const data = await toData(files[0], 600, 'image/png'), [w, h] = await imageSize(data);
        const url = await uploadImage(data);
        update(a => Object.assign(a.profile, { logo: url, logoH: Math.max(15, Math.min(150, Math.round((h / w) * 100))), logoSize: 30, logoZoom: 100, logoX: 0, logoY: 0 }));
      } else if (t.startsWith('ico:')) {
        const [, i, j] = t.split(':');
        const url = await uploadImage(await toData(files[0], 96, 'image/png'));
        update(a => { const it = a.blocks[+i] && a.blocks[+i].items && a.blocks[+i].items[+j]; if (it) { it.img = url; it.ico = ''; it.icon = ''; } });
      } else if (t.startsWith('img:')) {
        const i = +t.split(':')[1], urls = [];
        for (const f of files) urls.push(await uploadImage(await toData(f, 1000, 'image/jpeg')));
        update(a => { if (a.blocks[i] && a.blocks[i].imgs) a.blocks[i].imgs.push(...urls); });
      }
    } catch (err) {
      toast(err.message || 'Upload failed', { error: true });
    } finally { setUploading(false); }
  }

  if (loadError) {
    return (
      <div className="boot"><div>
        <b>{loadError.status === 404 ? 'Account not found' : 'Could not load this account'}</b>
        <p>{loadError.status === 404 ? 'It may have been deleted.' : loadError.message}</p>
        <Link to="/"><button className="pri">Back to accounts</button></Link>
      </div></div>
    );
  }
  if (!account) return <div className="boot" role="status">Loading…</div>;

  async function back() {
    if (!(await save())) {
      const leave = await confirm({ title: 'Your changes are not saved', text: 'The latest edits could not be saved. Leave anyway?', confirm: 'Leave', icon: 'back' });
      if (!leave) return;
    }
    nav('/');
  }
  const copy = async (text, msg) => toast((await copyText(text)) ? msg : text, { ms: 5000 });
  const share = () => {
    const url = pageUrl(account.slug);
    return navigator.share ? navigator.share({ url, title: account.profile.name }).catch(() => {}) : copy(url, 'Page link copied');
  };

  const ed = { ...editor, pickFile, open, setOpen };
  const statusText = uploading ? 'Uploading…' : STATUS[status];

  return (
    <>
      <header className="top">
        <button onClick={back}><Icon name="back" size={14} /> Accounts</button>
        <b>{account.profile.name || 'Account'}</b>
        <span className="sp" />
        <div className="dom">
          <span>{PUBLIC_HOST}/{account.slug}</span>
          <button onClick={() => copy(pageUrl(account.slug), 'Page link copied')}>Copy</button>
          <button onClick={() => window.open(pageUrl(account.slug), '_blank', 'noopener')}>Open <Icon name="open" size={13} /></button>
        </div>
        <button onClick={() => copy(nfcUrl(account.slug), 'NFC link copied')}>NFC link</button>
        <button className="pri" onClick={share}>Share</button>
      </header>
      <main>
        <div className="ed">
          <div>
            <div className="tb">
              <button disabled={!canUndo} onClick={() => undo(-1)}><Icon name="undo" size={14} /> Undo</button>
              <button disabled={!canRedo} onClick={() => undo(1)}>Redo <Icon name="redo" size={14} /></button>
              <span className="grow" />
              {status === 'failed' && !uploading
                ? <button onClick={save} style={{ color: '#dc2626' }}>Save failed. Retry</button>
                : <small role="status" style={{ color: 'var(--mut)', alignSelf: 'center' }}>{statusText}</small>}
            </div>
            <div className="tabs" role="tablist">
              {TABS.map(([k, n]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>)}
            </div>
            {tab === 'bio' && <BioTab ed={ed} />}
            {tab === 'design' && <DesignTab ed={ed} />}
            {tab === 'stats' && <StatsTab ed={ed} />}
          </div>
          <div><Preview account={account} /></div>
        </div>
      </main>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFiles} />
    </>
  );
}
