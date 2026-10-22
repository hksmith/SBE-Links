// System name, logo and colours (Settings → System). Applied to the whole admin app at runtime.
export const DEFAULT_SYSTEM = { name: 'SBPO Link Tree', logo: '', accent: '#4f46e5', accent2: '#06b6d4', sidebar: 'dark' };

// Ready-made colour pairs for Settings.
export const PRESETS = [
  ['Indigo', '#4f46e5', '#06b6d4'], ['Ocean', '#0369a1', '#22d3ee'], ['Emerald', '#047857', '#84cc16'], ['Forest', '#166534', '#ca8a04'],
  ['Sunset', '#ea580c', '#f43f5e'], ['Rose', '#be123c', '#a855f7'], ['Violet', '#7c3aed', '#ec4899'], ['Graphite', '#1f2937', '#64748b'],
];

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');

export function applyTheme(s) {
  const r = document.documentElement.style;
  r.setProperty('--a', s.accent);
  r.setProperty('--b', s.accent2);
  r.setProperty('--a-rgb', rgb(s.accent));
  r.setProperty('--b-rgb', rgb(s.accent2));
  document.documentElement.dataset.sidebar = s.sidebar;
  document.title = s.name + ' · Admin';
  let ic = document.querySelector('link[rel=icon]');
  if (s.logo) {
    if (!ic) { ic = document.createElement('link'); ic.rel = 'icon'; document.head.appendChild(ic); }
    ic.removeAttribute('type');
    ic.href = s.logo;
  }
}

// The system logo: the uploaded image, or the first letter of the system name on the theme colours.
export function SystemLogo({ system, size = 36 }) {
  return <i className={'sys-logo' + (system.logo ? ' has' : '')} style={{ width: size, height: size, fontSize: size * 0.48 }}>
    {system.logo ? <img src={system.logo} alt="" /> : (system.name.trim()[0] || 'S').toUpperCase()}
  </i>;
}
