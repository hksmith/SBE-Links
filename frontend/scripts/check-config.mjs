// Runs before `vite build`. On Vercel it stops the build if the deployment settings were left at their
// placeholders, because a frontend that talks to the wrong server (or prints wrong NFC links) fails in confusing
// ways. Locally it only prints a warning.
import { readFileSync } from 'node:fs';

const problems = [];
const direct = !!process.env.VITE_API_URL; // direct mode: the browser calls the server itself, rewrites are not used
if (!direct) {
  const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
  if (vercel.includes('api.example.com')) {
    problems.push('vercel.json still points at api.example.com. Replace it with your server address (4 places), or set VITE_API_URL to call the server directly.');
  }
}
if (!process.env.VITE_PUBLIC_URL && !direct) {
  problems.push('VITE_PUBLIC_URL is not set. Add it in Vercel → Settings → Environment Variables (your server address, e.g. https://sbpo-api.onrender.com).');
}

if (problems.length) {
  const onVercel = !!process.env.VERCEL;
  console.error(`\n${onVercel ? 'Build stopped' : 'Warning'}: deployment settings are incomplete\n  - ${problems.join('\n  - ')}\n`);
  if (onVercel) process.exit(1);
}
