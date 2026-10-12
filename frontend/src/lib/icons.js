// Icon set, loaded from the server once at start-up: ICONS[key] = [label, viewBox, svgInner, category]
export const ICONS = {};
export const loadIcons = data => Object.assign(ICONS, data);

// Guess an icon from a link URL (wa.me -> WhatsApp, mailto: -> Mail, …)
const GUESS = [[/wa\.me|whatsapp/, 'whatsapp'], [/t\.me|telegram/, 'telegram'], [/instagram\.com/, 'instagram'], [/facebook\.com|fb\.com|fb\.me/, 'facebook'], [/tiktok\.com/, 'tiktok'], [/(^|\/\/|\.)(x|twitter)\.com/, 'x'], [/youtube\.com|youtu\.be/, 'youtube'], [/linkedin\.com/, 'linkedin'], [/github\.com/, 'github'], [/snapchat\.com/, 'snapchat'], [/pinterest\./, 'pinterest'], [/reddit\.com/, 'reddit'], [/threads\.(net|com)/, 'threads'], [/twitch\.tv/, 'twitch'], [/discord\./, 'discord'], [/spotify\.com/, 'spotify'], [/soundcloud\.com/, 'soundcloud'], [/vimeo\.com/, 'vimeo'], [/medium\.com/, 'medium'], [/^mailto:.*@(gmail|googlemail)\.com/, 'gmail'], [/^mailto:/, 'mail'], [/^tel:/, 'phone'], [/maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl|google\.com\/maps/, 'googlemaps'], [/\.vcf|vcard/, 'contact'], [/^https?:/, 'globe']];

export const guess = u => {
  u = (u || '').trim().toLowerCase();
  for (const [r, k] of GUESS) if (r.test(u) && ICONS[k]) return k;
  return '';
};
