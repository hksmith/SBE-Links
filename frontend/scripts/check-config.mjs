// Runs before `vite build`. On Vercel it stops the build if the server address was left at its placeholder,
// because a frontend that talks to the wrong server fails in confusing ways. Locally it only prints a warning.
// The address is set once: in the rewrites of vercel.json (or VITE_API_URL for direct mode).
import { readFileSync } from 'node:fs';

const problems = [];
const direct = !!process.env.VITE_API_URL; // direct mode: the browser calls the server itself, rewrites are not used
if (!direct) {
  const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
  if (vercel.includes('api.example.com')) {
    problems.push('vercel.json still points at api.example.com. Replace it with your server address (4 places), or set VITE_API_URL to call the server directly.');
  }
}

if (problems.length) {
  const onVercel = !!process.env.VERCEL;
  console.error(`\n${onVercel ? 'Build stopped' : 'Warning'}: deployment settings are incomplete\n  - ${problems.join('\n  - ')}\n`);
  if (onVercel) process.exit(1);
}
