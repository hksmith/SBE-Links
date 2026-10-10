// The icon set lives on the server (GET /api/icons): key -> [label, viewBox, svg markup, group].
// group: 's' social/apps, 'g' general, 'u' UI-only (hidden from the picker).
import { createContext, useContext } from 'react';
import { asset } from './config.js';

export const IconsContext = createContext({});
export const useIcons = () => useContext(IconsContext);

export function Icon({ name, size = 18 }) {
  const d = useIcons()[name];
  if (!d) return null;
  return <svg viewBox={d[1]} width={size} height={size} fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d[2] }} />;
}

// Picture shown on a link's icon tile: uploaded image, icon, emoji, or a plus.
export function Tile({ item }) {
  if (item.img) return <img src={asset(item.img)} alt="" />;
  if (item.ico) return <Icon name={item.ico} size={36} />;
  if (item.icon) return <span style={{ fontSize: 32 }}>{item.icon}</span>;
  return <Icon name="plus" size={26} />;
}

// Guess an icon from a link URL (wa.me -> WhatsApp, mailto: -> Mail, ...).
const GUESS = [[/wa\.me|whatsapp/, 'whatsapp'], [/t\.me|telegram/, 'telegram'], [/instagram\.com/, 'instagram'], [/facebook\.com|fb\.com|fb\.me/, 'facebook'], [/tiktok\.com/, 'tiktok'], [/(^|\/\/|\.)(x|twitter)\.com/, 'x'], [/youtube\.com|youtu\.be/, 'youtube'], [/linkedin\.com/, 'linkedin'], [/github\.com/, 'github'], [/snapchat\.com/, 'snapchat'], [/pinterest\./, 'pinterest'], [/reddit\.com/, 'reddit'], [/threads\.(net|com)/, 'threads'], [/twitch\.tv/, 'twitch'], [/discord\./, 'discord'], [/spotify\.com/, 'spotify'], [/soundcloud\.com/, 'soundcloud'], [/vimeo\.com/, 'vimeo'], [/medium\.com/, 'medium'], [/^mailto:.*@(gmail|googlemail)\.com/, 'gmail'], [/^mailto:/, 'mail'], [/^tel:/, 'phone'], [/maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl|google\.com\/maps/, 'googlemaps'], [/\.vcf|vcard/, 'contact'], [/^https?:/, 'globe']];
export const guessIcon = (url, icons) => {
  const u = (url || '').trim().toLowerCase();
  for (const [re, k] of GUESS) if (re.test(u) && icons[k]) return k;
  return '';
};
