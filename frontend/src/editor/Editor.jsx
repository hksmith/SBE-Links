// Account editor: top bar, Link in Bio / Design / Analytics tabs, live phone preview, autosave and undo.
import { useState } from 'react';
import { O, cls } from '../lib/utils.js';
import { navigate } from '../lib/router.js';
import { Icon } from '../components/Icon.jsx';
import { CopyButton, ShareButton } from '../components/CopyButton.jsx';
import { Analytics } from '../views/Analytics.jsx';
import { EditorContext } from './fields.jsx';
import { useEditor } from './useEditor.js';
import { BioTab } from './BioTab.jsx';
import { DesignTab } from './DesignTab.jsx';

const TABS = [['bio', 'Link in Bio'], ['design', 'Design'], ['stats', 'Analytics']];

export function Editor({ id }) {
  const ed = useEditor(id);
  const { cur, stats, status, preview } = ed;
  const [tab, setTab] = useState('bio');
  const [open, setOpen] = useState(null); // expanded block id ('hdr' = header)
  const [thTab, setThTab] = useState('Classic');
  const [bsTab, setBsTab] = useState('Popular');

  const back = async () => { if (ed.dirty.current) await ed.save(); navigate('/'); };
  if (!cur || !stats) return <header className="top"><button onClick={() => navigate('/')}><Icon k="back" size={14} /> Accounts</button></header>;

  const pageUrl = `${O}/${cur.slug}`;
  const pickTab = k => { setTab(k); if (k === 'stats') ed.reloadStats(); };

  return (
    <EditorContext.Provider value={ed}>
      <header className="top">
        <button onClick={back}><Icon k="back" size={14} /> Accounts</button>
        <b>{cur.profile.name || 'Account'}</b>
        <span className="sp" />
        <div className="dom">
          <span>{pageUrl}</span>
          <CopyButton text={pageUrl} />
          <button onClick={() => window.open('/' + cur.slug, '_blank')}>Open <Icon k="open" size={13} /></button>
        </div>
        <CopyButton text={`${O}/n/${cur.slug}`}>NFC link</CopyButton>
        <ShareButton className="pri" url={pageUrl} title={cur.profile.name} />
      </header>
      <main>
        <div className="ed">
          <div>
            <div className="tb">
              <button onClick={() => ed.undo(-1)} disabled={!ed.canUndo}><Icon k="undo" size={14} /> Undo</button>
              <button onClick={() => ed.undo(1)} disabled={!ed.canRedo}>Redo <Icon k="redo" size={14} /></button>
              <span className="grow" />
              <small style={{ color: 'var(--mut)', alignSelf: 'center' }} aria-live="polite">{status}</small>
            </div>
            <div className="tabs">
              {TABS.map(([k, n]) => <button key={k} className={cls(tab === k && 'on')} onClick={() => pickTab(k)}>{n}</button>)}
            </div>
            <div>
              {tab === 'bio' && <BioTab open={open} setOpen={setOpen} />}
              {tab === 'design' && <DesignTab thTab={thTab} setThTab={setThTab} bsTab={bsTab} setBsTab={setBsTab} />}
              {tab === 'stats' && <Analytics account={cur} stats={stats} />}
            </div>
          </div>
          <div><div className="phone"><iframe title="Preview" srcDoc={preview} /></div></div>
        </div>
      </main>
    </EditorContext.Provider>
  );
}
