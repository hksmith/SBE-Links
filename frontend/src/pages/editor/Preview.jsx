// Phone-shaped live preview. The server renders the page (POST /api/preview) from the unsaved account;
// <base> points relative links (/go/..., /media/...) at the Node server, because the preview is shown
// on the dashboard's origin where those routes do not exist.
import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { PUBLIC_URL } from '../../config.js';

export default function Preview({ account }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const r = await api('/api/preview', { method: 'POST', body: account, raw: true });
        const text = await r.text();
        if (!stale) setHtml(text.replace('<head>', `<head><base href="${PUBLIC_URL}/">`));
      } catch { /* keep the last good preview */ }
    }, 300);
    return () => { stale = true; clearTimeout(t); };
  }, [account]);

  return (
    <div className="phone">
      <iframe title="Page preview" srcDoc={html} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" />
    </div>
  );
}
