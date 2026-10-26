// Presets and catalogues used by the editor (themes, fonts, block types, quick-add links).
import { rid } from './utils.js';

export const PRE = {
  Neutral: { pageBg: '#ffffff', headText: '#111111', linkBg: '#111111', linkText: '#ffffff', linkShadow: '#111111', blockBg: '#f3f3f3', blockText: '#111111' },
  Bold: { pageBg: '#111111', headText: '#ffffff', linkBg: '#facc15', linkText: '#111111', linkShadow: '#facc15', blockBg: '#222222', blockText: '#ffffff' },
  Playful: { pageBg: '#fde7f3', headText: '#4a1d96', linkBg: '#8b5cf6', linkText: '#ffffff', linkShadow: '#f9a8d4', blockBg: '#ffffff', blockText: '#4a1d96' },
};
// Keep in step with FONTS in server/src/services/sanitize.js.
export const FONTS = ['Inter', 'Sora', 'Poppins', 'DM Sans', 'Montserrat', 'Outfit', 'Manrope', 'Plus Jakarta Sans', 'Urbanist', 'Raleway', 'Nunito', 'Roboto', 'Open Sans', 'Lato', 'Work Sans', 'Rubik', 'Oswald',
  'Playfair Display', 'Lora', 'Libre Baskerville', 'Cormorant Garamond', 'Linden Hill', 'Merriweather', 'Space Grotesk', 'Space Mono', 'Orbitron', 'Bebas Neue', 'Pacifico', 'Dancing Script', 'Great Vibes',
  'Noto Sans Ethiopic', 'Noto Serif Ethiopic', 'Abyssinica SIL'];
export const FP = { Modern: ['Inter', 'Inter'], Sleek: ['Sora', 'Sora'], Classic: ['Playfair Display', 'Lora'], Creative: ['Pacifico', 'Poppins'], Logo: ['Bebas Neue', 'Montserrat'], Futuristic: ['Orbitron', 'Space Grotesk'] };
// Keys each preset tab controls (Colors, Fonts, Block style). What the person set under “Custom” is kept in theme.cust.
export const COLOR_KEYS = ['pageBg', 'headText', 'linkBg', 'linkText', 'linkShadow', 'blockBg', 'blockText'];
export const GROUP_KEYS = { colors: COLOR_KEYS, fonts: ['disp', 'body'], block: ['radius', 'alpha', 'shadow', 'outline'] };
// Where the company logo can go on a card.
export const LOGO_POS = [['tl', 'Top left'], ['tc', 'Top center'], ['tr', 'Top right'], ['', ''], ['under', 'Between photo and name'], ['', ''], ['bl', 'Below the name, left'], ['bc', 'Below the name, center'], ['br', 'Below the name, right']];
export const BG_POS = [['top left', 'Top left'], ['top', 'Top'], ['top right', 'Top right'], ['left', 'Left'], ['center', 'Center'], ['right', 'Right'], ['bottom left', 'Bottom left'], ['bottom', 'Bottom'], ['bottom right', 'Bottom right']];
export const BS = {
  Classic: { radius: 12, alpha: 0, shadow: false, outline: true },
  Pill: { radius: 40, alpha: 0, shadow: false, outline: true },
  Sharp: { radius: 0, alpha: 0, shadow: false, outline: true },
  Shadow: { radius: 14, alpha: 0, shadow: true, outline: false },
  Glass: { radius: 16, alpha: 55, shadow: false, outline: true },
};
export const BASE = { bgType: 'solid', bg2: '#302b63', bgImage: '', radius: 12, disp: 'Inter', body: 'Inter', alpha: 0, shadow: false, outline: true };
export const mkT = x => ({ ...BASE, pageBg: x[1], headText: x[2], linkBg: x[3], linkText: x[4], linkShadow: x[5], blockBg: x[6], blockText: x[7], ...x[8] });
export const THEMES = {
  Classic: [
    ['Paper', '#ffffff', '#111111', '#111111', '#ffffff', '#111111', '#f3f3f3', '#111111', { disp: 'Playfair Display', body: 'Lora' }],
    ['Linen', '#f6f1e9', '#2b2118', '#2b2118', '#f6f1e9', '#2b2118', '#ebe3d6', '#2b2118', { radius: 6, disp: 'Libre Baskerville', body: 'Lora' }],
    ['Royal', '#ffffff', '#000000', '#4a1052', '#bde3ff', '#7cc4f5', '#f3f3f3', '#111111', { radius: 6, disp: 'Linden Hill', body: 'Libre Baskerville' }],
    ['Slate', '#0f172a', '#f8fafc', '#1e293b', '#e2e8f0', '#475569', '#1e293b', '#e2e8f0', { radius: 10 }],
  ],
  Vibrant: [
    ['Sunset', '#ff9a8b', '#ffffff', '#ffffff', '#d6335a', '#ffffff', '#ffffff', '#d6335a', { bgType: 'gradient', bg2: '#ff6a88', radius: 20, disp: 'Poppins', body: 'Poppins', outline: false, shadow: true }],
    ['Aurora', '#0f0c29', '#ffffff', '#8b78ff', '#ffffff', '#c4b5fd', '#1e1b4b', '#ffffff', { bgType: 'gradient', bg2: '#302b63', radius: 16, disp: 'Space Grotesk' }],
    ['Ocean', '#0f2027', '#e8f6ff', '#38bdf8', '#06202e', '#7dd3fc', '#12303d', '#e8f6ff', { bgType: 'gradient', bg2: '#2c5364', radius: 14, disp: 'Montserrat', body: 'Montserrat', outline: false, shadow: true }],
    ['Candy', '#fde7f3', '#4a1d96', '#8b5cf6', '#ffffff', '#f9a8d4', '#ffffff', '#4a1d96', { bgType: 'gradient', bg2: '#e9d5ff', radius: 28, disp: 'Pacifico', body: 'Poppins' }],
  ],
  Cozy: [
    ['Latte', '#efe3d3', '#4a3426', '#7a5640', '#fff8ef', '#a98467', '#fff8ef', '#4a3426', { radius: 24, disp: 'Lora', body: 'Poppins', outline: false, shadow: true }],
    ['Sage', '#dfe8dc', '#2f4a33', '#5b7f5f', '#f4fbf2', '#8fb095', '#f4fbf2', '#2f4a33', { radius: 22, disp: 'Merriweather', body: 'DM Sans', outline: false, shadow: true }],
    ['Blush', '#fbe4e4', '#6b2d3a', '#c9707f', '#ffffff', '#e9a3ae', '#ffffff', '#6b2d3a', { radius: 30, disp: 'Playfair Display', body: 'DM Sans' }],
    ['Dusk', '#2b2438', '#f1e9ff', '#6d5a9c', '#f1e9ff', '#9b87cf', '#3a3150', '#f1e9ff', { radius: 20, disp: 'DM Sans', body: 'DM Sans', outline: false, shadow: true }],
  ],
  Bold: [
    ['Volt', '#0b0b0b', '#c8ff00', '#c8ff00', '#0b0b0b', '#c8ff00', '#1a1a1a', '#c8ff00', { radius: 0, disp: 'Bebas Neue', body: 'Montserrat' }],
    ['Brutal', '#facc15', '#111111', '#ffffff', '#111111', '#111111', '#ffffff', '#111111', { radius: 0, disp: 'Space Grotesk', body: 'Space Mono', shadow: true }],
    ['Neon', '#0a0a14', '#ff3cac', '#ff3cac', '#0a0a14', '#784ba0', '#15152a', '#ffffff', { radius: 4, disp: 'Orbitron', body: 'Space Grotesk' }],
    ['Mono', '#ffffff', '#000000', '#ffffff', '#000000', '#000000', '#f3f3f3', '#000000', { radius: 0, disp: 'Space Mono', body: 'Space Mono' }],
  ],
};

export const NAME = { links: 'Links – Classic Layout', social: 'Social chips', images: 'Images', text: 'Text', video: 'Video', contact: 'Save contact (vCard)', divider: 'Divider' };
export const ICON = { links: 'link', social: 'people', images: 'image', text: 'text', video: 'video', contact: 'contact', divider: 'divider' };
export const CAT = [
  ['links', 'Buttons for WhatsApp, phone, website, anything', 'Quick add'],
  ['contact', 'Button that opens your own vCard link', 'Quick add'],
  ['images', 'Photos, banners, company logos', 'Quick add'],
  ['video', 'Embed a YouTube video', 'Quick add'],
  ['text', 'A paragraph or note', 'Layout'],
  ['social', 'Small round social chips', 'Layout'],
  ['divider', 'A thin separator line', 'Layout'],
];
export const NEWB = {
  links: () => ({ items: [{ id: rid(), ico: 'link', title: '', sub: '', url: '', off: false }] }),
  social: () => ({ items: [] }),
  images: () => ({ imgs: [] }),
  text: () => ({ text: '' }),
  video: () => ({ url: '' }),
  contact: () => ({ label: 'Save My Contact', url: '' }),
  divider: () => ({}),
};
// Quick-add link buttons: [icon, title, url prefix]
export const Q = { WhatsApp: ['whatsapp', 'WhatsApp', 'https://wa.me/'], Call: ['phone', 'Call me', 'tel:'], Email: ['mail', 'Email me', 'mailto:'], Gmail: ['gmail', 'Gmail', 'mailto:'], Website: ['globe', 'Website', 'https://'], LinkedIn: ['linkedin', 'LinkedIn', 'https://linkedin.com/in/'], Telegram: ['telegram', 'Telegram', 'https://t.me/'], Location: ['pin', 'Our location', 'https://maps.google.com/?q='] };
// Quick-add social chips: [icon, url prefix]
export const QS = { Instagram: ['instagram', 'https://instagram.com/'], TikTok: ['tiktok', 'https://tiktok.com/@'], Facebook: ['facebook', 'https://facebook.com/'], X: ['x', 'https://x.com/'], YouTube: ['youtube', 'https://youtube.com/@'], LinkedIn: ['linkedin', 'https://linkedin.com/in/'], WhatsApp: ['whatsapp', 'https://wa.me/'], Telegram: ['telegram', 'https://t.me/'] };
// Text style targets: [key, label, default size]
export const TXK = [['name', 'Name', 30], ['title', 'Job title', 16], ['dept', 'Department', 16], ['company', 'Company name', 18], ['bio', 'Bio', 16], ['link', 'Link titles', 17], ['sub', 'Link subtitles', 13], ['block', 'Text blocks', 16], ['foot', 'Footer text', 12]];
