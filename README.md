# SBPO Link Tree

Multi-account link-in-bio pages for NFC business cards, with tap/click analytics.

| Folder | What | Where it runs |
|---|---|---|
| **frontend/** | The admin app. React + Vite, no HTML pages. This is the only frontend folder. | **Vercel** |
| **server/** | Node.js API, public profile pages (`/<slug>`, `/n/<slug>`) and link redirects. Data in **MongoDB**. | **Render** (+ MongoDB Atlas) |

```
sbpo-link-tree/
├── frontend/        React + Vite admin app (see frontend/README.md)
├── server/          API + public pages (src/, test/, scripts/, data/, .env.example)
├── render.yaml      Render blueprint for the server
├── deploy.sh        optional: install the server on your own Ubuntu/Debian machine
└── start-windows.bat   optional: run the server on Windows
```

## Deploy

### 1. Database: MongoDB Atlas
Create a free cluster, a database user, and under **Network Access** allow `0.0.0.0/0` (Render's addresses change).
Copy the connection string, which is your `MONGODB_URI`.

### 2. Server on Render
New → **Blueprint** → pick this repo (it reads `render.yaml`), or create a *Web Service* by hand with Root Directory
`server`, build `npm install --omit=dev`, start `npm start`, health check `/health`.
Fill in the environment variables (full list below); at minimum `MONGODB_URI`, `ADMIN_PASSWORD`, `CLIENT_ORIGIN`.
You can only know `CLIENT_ORIGIN` after step 3, so deploy the frontend once, then come back and set it.

### 3. Frontend on Vercel
Import the repo, set **Root Directory** to `frontend`, then:
1. In `frontend/vercel.json`, replace `https://api.example.com` with your Render address (4 places).
2. Add the variable `VITE_PUBLIC_URL` = your Render address.
3. Deploy, then put the Vercel address into `CLIENT_ORIGIN` on Render.

Details and the alternative "direct" mode are in `frontend/README.md`.

> **NFC cards and the free Render plan.** Cards open `https://<your-server>/n/<slug>`. A free Render service goes to sleep
> after about 15 minutes without traffic, so the first tap after a quiet period can wait up to a minute.
> Use a paid instance for cards you give to customers, or put the server behind your own domain on an always-on host.

## Run on your computer

```bash
# server  (needs Node 18+ and MongoDB, local or Atlas)
cp server/.env.example server/.env      # then edit it
npm install                             # installs the server packages
npm start                               # http://localhost:3000

# frontend (second terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173
```
On Windows you can double-click `start-windows.bat` for the server, then run the frontend as above.

## Server environment variables

Every setting lives in `server/.env` locally, or under **Environment** on Render. `server/.env.example` has the same list with comments.

| Name | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Render sets this for you. |
| `TRUST_PROXY` | off | Set `1` on Render / behind Nginx or Caddy (real client IP, HTTPS detection). |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/sbpo-link-tree` | MongoDB Atlas or local connection string. **Required** in production. |
| `MONGODB_DB` | database in the URI | Override the database name. |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `admin` / random (printed at start) | Admin login. Use a long password. |
| `SESSION_DAYS` | `7` | How long a sign-in lasts. |
| `CLIENT_ORIGIN` | none | Address(es) of the deployed frontend, comma separated, no trailing slash. **Required** in production: it enables CORS for the frontend, blocks other websites from sending changes as the admin, and `/` redirects there. |
| `COOKIE_SAMESITE` | `strict` | `strict` when the frontend uses the Vercel rewrites (recommended). `none` when the browser calls the server directly from another site. |
| `COOKIE_SECURE` | automatic | Force the cookie's `Secure` flag with `1`/`0`. Always on for `none`. |
| `LEGACY_DATA_FILE` | `server/data/legacy-data.json` | Old `data.json`, imported once into an **empty** database. |

## MongoDB collections

| Collection | What it holds |
|---|---|
| `accounts` | One document per person (`_id` = account id, unique `slug`), profile, theme, blocks |
| `events` | Every page view and link click (`a` account, `k` view/click, `src`, `dev`, `t`) |
| `stats` | Running totals per account so the dashboard loads instantly |
| `media` | Uploaded images, referenced as `/media/<id>` |
| `settings` | Brand logo and the session-signing secret |

## Server URLs

| URL | |
|---|---|
| `/<slug>` | Public profile page (server-rendered, so it loads fast on a tap) |
| `/n/<slug>` | Same page, counted as an NFC tap (write this to the card) |
| `/go/<account>/<link>`, `/vcf/<account>` | Tracked redirects |
| `/media/<id>` | Uploaded image |
| `/api/...` | Admin JSON API (needs login) |
| `POST /login`, `POST /logout`, `GET /health`, `GET /` | Session, health check, redirect to the frontend |

## Moving from the old data.json

The first time the server starts with an **empty** MongoDB database it imports `server/data/legacy-data.json`
(or `LEGACY_DATA_FILE`): accounts, stats, brand logo and the session secret. To import a file by hand:
`npm run migrate -- path/to/data.json`. Existing accounts (same id) are skipped, so running it twice is safe.

## Tests

```bash
npm test
```
Runs the API end to end (login, CORS and cross-site write protection, cookies, import, create/edit/delete, tracking)
against an in-memory MongoDB stand-in, so no database is needed.
