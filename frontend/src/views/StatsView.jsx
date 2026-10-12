// Read-only statistics page for viewers: no editor, no design, no settings.
import { useEffect, useState } from 'react';
import { getJson } from '../lib/api.js';
import { O } from '../lib/utils.js';
import { toast } from '../lib/toast.js';
import { navigate } from '../lib/router.js';
import { Icon } from '../components/Icon.jsx';
import { Analytics } from './Analytics.jsx';
import { Footer } from '../components/TopBar.jsx';

export function StatsView({ id }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    getJson('/api/accounts/' + id).then(setData).catch(() => { toast('That card was not found', { error: true }); navigate('/'); });
  }, [id]);

  const back = <button onClick={() => navigate('/')}><Icon k="back" size={14} /> Accounts</button>;
  if (!data) return <header className="top">{back}</header>;

  const { stats, ...account } = data, p = account.profile;
  return <>
    <header className="top">
      {back}
      <b>{p.name || 'Account'}</b><span className="role viewer">View only</span><span className="sp" />
      <a href={`${O}/${account.slug}`} target="_blank" rel="noopener"><button>Open page <Icon k="open" size={13} /></button></a>
    </header>
    <main style={{ maxWidth: 860 }}>
      <div className="hero"><h1>{p.name || 'Account'}</h1><p>{[p.title, p.company].filter(Boolean).join(' · ') || ' '}</p></div>
      <Analytics account={account} stats={stats} />
    </main>
    <Footer />
  </>;
}
