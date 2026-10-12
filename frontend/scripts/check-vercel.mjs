// Runs before `vite build` on Vercel only: stops the build if the server address in vercel.json is still the
// placeholder, because the site would load but every sign-in, API call and NFC page would fail.
import { readFileSync } from 'node:fs';

if (process.env.VERCEL) {
  const v = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
  if (v.includes('api.example.com')) {
    console.error('\nBuild stopped: vercel.json still points at https://api.example.com.\n' +
      '  Replace it with your Render server address (e.g. https://your-service.onrender.com), then push again.\n');
    process.exit(1);
  }
}
