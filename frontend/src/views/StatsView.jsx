// Read-only statistics page for viewers: no editor, no design, no settings. Refreshes by itself.
import { useCallback, useEffect, useState } from 'react';
import { getJson } from '../lib/api.js';
import { O } from '../lib/utils.js';
import { toast } from '../lib/toast.js';
import { navigate } from '../lib/router.js';
import { useLive } from '../lib/live.js';
import { Icon } from '../components/Icon.jsx';
import { Analytics } from './Analytics.jsx';
import { PageHeader } from '../components/TopBar.jsx';

export function StatsView({ id }) {
  const [data, setData] = useState(null);
  const load = useCallback(async () => setData(await getJson('/api/accounts/' + id)), [id]);
  useEffect(() => { load().catch(() => { toast('That card was not found', { error: true }); navigate('/'); }); }, [load]);
  const updated = useLive(load);

  const back = data && data.companyInfo ? ['/company/' + data.companyInfo.id, data.companyInfo.name] : ['/cards', 'Cards'];
  if (!data) return <PageHeader title="Statistics" back={back} />;

  const { stats, ...account } = data, p = account.profile;
  return <>
    <PageHeader title={p.name || 'Card'} sub={[p.title, p.company].filter(Boolean).join(' · ') || 'View only'} back={back} live={updated}>
      <a href={`${O}/${account.path || account.slug}`} target="_blank" rel="noopener"><button>Open page <Icon k="open" size={13} /></button></a>
    </PageHeader>
    <main style={{ maxWidth: 980 }}>
      <Analytics account={account} stats={stats} />
    </main>
  </>;
}
