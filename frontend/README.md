# SBPO Link Tree · Frontend (React + Vite)

The admin app: accounts list and totals, editor (header, links, social chips, text, images, video, vCard button,
drag-and-drop ordering, undo/redo, autosave), live phone preview, Design tab, Analytics tab, footer logo.
It is the only frontend in the project, a plain React single-page app with no HTML pages other than Vite's one `index.html` shell.

## How it reaches the server

Pick one. **Proxy mode is the default and the recommended one.**

**Proxy mode** (`VITE_API_URL` empty). The browser only talks to the Vercel address. `vercel.json` forwards
`/api`, `/login`, `/logout`, `/media` to your Render server. The login cookie stays first-party, so it works in every browser.
```
Browser ─▶ your-app.vercel.app ─┬─ React app
                                └─ /api /login /logout /media ─▶ rewrite ─▶ Render server
```

**Direct mode** (`VITE_API_URL=https://your-api.onrender.com`). The browser calls the server itself.
The server must have `CLIENT_ORIGIN=<your Vercel address>` and `COOKIE_SAMESITE=none`. The cookie is then cross-site, and
Safari and browsers with strict privacy settings block those cookies, so sign-in can fail for some people. It is dependable
only when both addresses share one parent domain (e.g. `app.example.com` and `api.example.com`).

In **both** modes set `CLIENT_ORIGIN` on the server to the frontend address.

## Deploy on Vercel

1. Replace `https://api.example.com` with your server address in all 4 rewrites in `vercel.json` (proxy mode).
2. Environment variables (Vercel → Settings → Environment Variables):
   - `VITE_PUBLIC_URL` = your server address (NFC links, "Open page" and the preview use it).
   - `VITE_API_URL` only for direct mode.
3. Import the repo with **Root Directory** = `frontend` (Vercel detects Vite: build `npm run build`, output `dist`).
4. On the server set `CLIENT_ORIGIN` to the Vercel address (e.g. `https://sbpo-admin.vercel.app`).
5. Open the site and sign in with the server's `ADMIN_USER` / `ADMIN_PASSWORD`.

If a setting is forgotten the Vercel build **stops with a clear message** instead of deploying something that points at the wrong place.

**Refreshing and deep links:** the last rewrite (`/(.*)` → `/index.html`) hands every unknown path to the app, so reloading
`/accounts/abc123` works. Files that exist (JS, CSS, favicon) are served first and the four server paths are matched before
the catch-all, so keep the rewrites in this order.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```
Start the server first (project root: `npm start`). `npm run dev` forwards the API paths to `http://localhost:3000`
(change with `DEV_BACKEND_URL` in `frontend/.env`). If the server has `CLIENT_ORIGIN` set, use `http://localhost:5173` for local work.

## What talks to what

| Frontend calls | Server route |
|---|---|
| sign in / out | `POST /login`, `POST /logout` (cookie `sid`; any `401` shows the sign-in form in place) |
| list, create, delete | `GET/POST /api/accounts`, `DELETE /api/accounts/:id` |
| open, save, analytics | `GET/PUT /api/accounts/:id` (autosave about 1 s after the last edit) |
| live preview | `POST /api/preview` |
| images | `POST /api/media`, `GET /media/<id>` |
| icons, brand logo | `GET /api/icons`, `GET/PUT /api/brand` |

## Good to know

- Behind Vercel the server sees the same IP for every login attempt, so the "8 tries per 10 minutes" limit is shared by everyone. Fine for one admin.
- Public profile pages (`/<slug>`, `/n/<slug>`) are still rendered by the server, not by this app. They need to answer instantly on an NFC tap and record the tap.

## Structure

```
frontend/
├── vercel.json            rewrites to the server + SPA fallback
├── vite.config.js         dev proxy
├── .env.example           frontend variables
├── scripts/check-config.mjs   stops a Vercel build with placeholder settings
└── src/
    ├── App.jsx            session gate + routes (/ and /accounts/:id)
    ├── api.js  config.js  fetch wrapper (proxy or direct mode), public URL helpers
    ├── hooks/useAccountEditor.js   edit state, undo history, autosave
    ├── pages/             Login, Dashboard, Editor (+ editor/BioTab, DesignTab, StatsTab, Preview)
    └── components/        Dialog (modal + confirm), Toast
```
