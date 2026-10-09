// Icon set (loaded from the server once) and helpers to draw icons.
import { esc } from './utils.js';

export const ICONS = {};
export const loadIcons = data => Object.assign(ICONS, data);

export const IC=(k,z=18)=>ICONS[k]?`<svg viewBox="${ICONS[k][1]}" width="${z}" height="${z}" fill="currentColor" aria-hidden="true">${ICONS[k][2]}</svg>`:'';
export const tileHTML=it=>it.img?`<img src="${it.img}" alt="">`:it.ico&&ICONS[it.ico]?IC(it.ico,36):it.icon?`<span style="font-size:32px">${esc(it.icon)}</span>`:IC('plus',26);
// Guess an icon from a link URL (wa.me -> WhatsApp, mailto: -> Mail, …)
const GUESS=[[/wa\.me|whatsapp/,'whatsapp'],[/t\.me|telegram/,'telegram'],[/instagram\.com/,'instagram'],[/facebook\.com|fb\.com|fb\.me/,'facebook'],[/tiktok\.com/,'tiktok'],[/(^|\/\/|\.)(x|twitter)\.com/,'x'],[/youtube\.com|youtu\.be/,'youtube'],[/linkedin\.com/,'linkedin'],[/github\.com/,'github'],[/snapchat\.com/,'snapchat'],[/pinterest\./,'pinterest'],[/reddit\.com/,'reddit'],[/threads\.(net|com)/,'threads'],[/twitch\.tv/,'twitch'],[/discord\./,'discord'],[/spotify\.com/,'spotify'],[/soundcloud\.com/,'soundcloud'],[/vimeo\.com/,'vimeo'],[/medium\.com/,'medium'],[/^mailto:.*@(gmail|googlemail)\.com/,'gmail'],[/^mailto:/,'mail'],[/^tel:/,'phone'],[/maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl|google\.com\/maps/,'googlemaps'],[/\.vcf|vcard/,'contact'],[/^https?:/,'globe']];
export const guess=u=>{u=(u||'').trim().toLowerCase();for(const[r,k]of GUESS)if(r.test(u)&&ICONS[k])return k;return ''};
