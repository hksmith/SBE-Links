import { useEffect, useState } from 'react';
import { subscribeToasts } from '../lib/toast.js';

export function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => subscribeToasts(setItems), []);
  return (
    <div className="toasts" aria-live="polite">
      {items.map(t => <div key={t.id} className={'toast' + (t.error ? ' err' : '')}>{t.text}</div>)}
    </div>
  );
}
