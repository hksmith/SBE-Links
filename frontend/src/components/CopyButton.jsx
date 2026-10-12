import { useState } from 'react';
import { copyText } from '../lib/utils.js';

// Button that copies `text` and briefly shows "Copied ✓".
export function CopyButton({ text, children = 'Copy', ...rest }) {
  const [done, setDone] = useState(false);
  const onClick = async e => {
    e.stopPropagation();
    if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1400); }
  };
  return <button type="button" {...rest} onClick={onClick}>{done ? 'Copied ✓' : children}</button>;
}

// "Share" uses the phone's share sheet when there is one, otherwise copies the link.
export function ShareButton({ url, title, children = 'Share', ...rest }) {
  const [done, setDone] = useState(false);
  const onClick = async () => {
    if (navigator.share) return navigator.share({ url, title }).catch(() => {});
    if (await copyText(url)) { setDone(true); setTimeout(() => setDone(false), 1400); }
  };
  return <button type="button" {...rest} onClick={onClick}>{done ? 'Copied ✓' : children}</button>;
}
