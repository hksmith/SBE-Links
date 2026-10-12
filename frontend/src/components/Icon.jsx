import { ICONS } from '../lib/icons.js';

// One icon from the server's icon set (its SVG paths are trusted, they ship with the server).
export function Icon({ k, size = 18 }) {
  const d = ICONS[k];
  if (!d) return null;
  return <svg viewBox={d[1]} width={size} height={size} fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d[2] }} />;
}

// What a link's icon tile shows: uploaded image, icon, emoji, or a "+" placeholder.
export function Tile({ it }) {
  if (it.img) return <img src={it.img} alt="" />;
  if (it.ico && ICONS[it.ico]) return <Icon k={it.ico} size={36} />;
  if (it.icon) return <span style={{ fontSize: 32 }}>{it.icon}</span>;
  return <Icon k="plus" size={26} />;
}
