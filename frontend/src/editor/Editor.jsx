// Editor: top bar, Link in Bio / Design / Analytics tabs, live phone preview, autosave and undo.
// Edits a card (kind 'account'), a company page ('page') or a company's card design ('template').
import { useEffect, useState } from 'react';
import { LiveBadge } from '../components/Live.jsx';
import { O, cls } from '../lib/utils.js';
import { navigate } from '../lib/router.js';
import { Icon } from '../components/Icon.jsx';
import { CopyButton, ShareButton } from '../components/CopyButton.jsx';
import { Analytics } from '../views/Analytics.jsx';
import { resetCardStats } from '../views/accountActions.jsx';
import { send } from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { confirmDialog } from '../components/Dialog.jsx';
import { EditorContext } from './fields.jsx';
import { useEditor } from './useEditor.js';
import { BioTab } from './BioTab.jsx';
import { DesignTab } from './DesignTab.jsx';

const TABS = {
  account: [['bio', 'Link in Bio'], ['design', 'Design'], ['stats', 'Analytics']],
  page: [['bio', 'Company page'], ['design', 'Design'], ['stats', 'Analytics']],
  template: [['bio', 'Card content'], ['design', 'Design']],
};

export function Editor({ id, kind = 'account' }) {
  const ed = useEditor(id, kind);
  const { cur, stats, status, preview } = ed;
  const [tab, setTab] = useState('bio');
  const [open, setOpen] = useState(kind === 'account' ? null : 'hdr'); // expanded block id ('hdr' = header)
  const [thTab, setThTab] = useState('Classic');
  const [bsTab, setBsTab] = useState('Popular');

  const co = cur && cur.companyInfo;
  const home = kind !== 'account' || (cur && cur.company) ? `/company/${co ? co.id : id}` : '/cards';
  const back = async () => { if (ed.dirty.current) await ed.save(); navigate(home); };
  const backBtn = <button onClick={back}><Icon k="back" size={14} /> {co ? co.name : 'Cards'}</button>;
  // The Analytics tab refreshes by itself while it is open.
  const [live, setLive] = useState(0);
  useEffect(() => {
    if (tab !== 'stats') return;
    const t = setInterval(() => { if (!document.hidden) ed.reloadStats().then(() => setLive(Date.now())).catch(() => {}); }, 10e3);
    return () => clearInterval(t);
  }, [tab, ed.reloadStats]);
  if (!cur || !stats) return <header className="top">{backBtn}</header>;

  const path = cur.path || cur.slug, pageUrl = `${O}/${path}`;
  const pickTab = k => { setTab(k); if (k === 'stats') ed.reloadStats(); };
  const title = kind === 'page' ? 'Company page' : kind === 'template' ? 'Card design for everyone' : cur.profile.name || 'Account';

  return (
    <EditorContext.Provider value={ed}>
      <header className="top">
        {backBtn}
        <div className="ph-t"><h1>{title}</h1></div>
        <span className="sp" />
        {tab === 'stats' && <LiveBadge updated={live} />}
        {kind !== 'template' && <>
          <div className="dom">
            <span>{pageUrl}</span>
            <CopyButton text={pageUrl} />
            <button onClick={() => window.open('/' + path, '_blank')}>Open <Icon k="open" size={13} /></button>
          </div>
          <CopyButton text={`${O}/n/${path}`}>NFC link</CopyButton>
          <ShareButton className="pri" url={pageUrl} title={cur.profile.name} />
        </>}
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
              {TABS[kind].map(([k, n]) => <button key={k} className={cls(tab === k && 'on')} onClick={() => pickTab(k)}>{n}</button>)}
            </div>
            <div>
              {tab === 'bio' && <BioTab open={open} setOpen={setOpen} />}
              {tab === 'design' && <DesignTab thTab={thTab} setThTab={setThTab} bsTab={bsTab} setBsTab={setBsTab} />}
              {tab === 'stats' && <>
                <Analytics account={cur} stats={stats} />
                <div className="reset-row">
                  <small>Testing the card yourself? Start counting again from zero.</small>
                  <button className="danger-btn" disabled={!stats.views && !stats.clicks} onClick={async () => {
                    if (kind === 'page') { // the company page only
                      if (!(await confirmDialog({ title: 'Reset the company page statistics?', text: 'Its views, taps and clicks are deleted and counting starts again from zero. The cards of the company keep theirs. This can’t be undone.', confirm: 'Reset statistics', icon: 'graph' }))) return;
                      try { await send(`/api/companies/${id}/reset-stats`, 'POST', { scope: 'page' }); toast('Statistics reset'); } catch (e) { return toast(e.message, { error: true }); }
                    } else if (!(await resetCardStats({ id, name: cur.profile.name, views: stats.views, clicks: stats.clicks }))) return;
                    ed.reloadStats();
                  }}><Icon k="graph" size={14} /> Reset statistics</button>
                </div>
              </>}
            </div>
          </div>
          <div>
            <div className="phone"><iframe title="Preview" srcDoc={preview} /></div>
            {kind === 'template' && <small className="hint" style={{ display: 'block', textAlign: 'center', marginTop: 10 }}>Preview with the sample details. Each card shows its own.</small>}
          </div>
        </div>
      </main>
    </EditorContext.Provider>
  );
}
