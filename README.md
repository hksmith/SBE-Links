# SBPO Link Tree

Multi-account link-in-bio pages for NFC business cards, with tap/click analytics.

- **client/** – the admin web app (plain HTML/CSS/ES modules, no build step), served at `/admin`
- **server/** – Node.js API, public profile pages and redirects, data stored in **MongoDB**

## Project structure

```
sbpo-link-tree/
├── client/                     Admin web app (served by the server under /admin)
│   ├── index.html              App shell (shown when signed in)
│   ├── login.html              Sign-in page
│   ├── assets/                 Favicon
│   ├── css/                    admin.css (app + dialogs), login.css
│   └── js/
│       ├── main.js             Entry point: boots the app, wires up all UI events
│       ├── api.js              fetch wrapper + image upload
│       ├── state.js            Shared app state
│       ├── constants.js        Themes, fonts, block types, quick-add links
│       ├── icons.js            Icon set helpers
│       ├── utils.js            DOM/format helpers
│       ├── components/         dialog.js (centered modal), toast.js
│       └── views/              dashboard.js, editor.js, design.js, analytics.js
├── server/
│   ├── src/
│   │   ├── index.js            Entry point: connect MongoDB, import old data, start HTTP
│   │   ├── app.js              Request handler + route registration
│   │   ├── config.js           Settings from environment / server/.env
│   │   ├── db/                 MongoDB connection, collections, indexes
│   │   ├── repositories/       accounts, events (+stats), media, settings
│   │   ├── services/           auth, render (public page), sanitize, stats, media, brand, migrate
│   │   ├── routes/             admin.js, api.js, public.js
│   │   ├── lib/                http helpers, tiny router
│   │   └── data/icons.js       SVG icon set
│   ├── scripts/migrate-json.js Import an old data.json by hand
│   ├── data/legacy-data.json   Your previous data.json (imported automatically on first start)
│   ├── test/                   API tests (run against an in-memory MongoDB stand-in)
│   └── .env.example
├── start-windows.bat           Double-click to run on Windows
├── deploy.sh                   One-command install on an Ubuntu/Debian server
└── package.json                Convenience scripts (npm install / npm start from the root)
```

## MongoDB collections

| Collection | What it holds |
|---|---|
| `accounts` | One document per person (`_id` = account id, unique `slug`), profile, theme, blocks |
| `events` | Every page view and link click (`a` account, `k` view/click, `src`, `dev`, `t`) |
| `stats` | Running totals per account so the dashboard loads instantly |
| `media` | Uploaded images (photos, logos, gallery, icons), referenced as `/media/<id>` |
| `settings` | Brand logo and the session-signing secret |

## Running it

You need **Node.js 18+** and **MongoDB** (local MongoDB Community Server, or a free MongoDB Atlas cluster).

### Windows
1. Install Node.js LTS and MongoDB Community Server (leave “Install as a service” ticked).
2. Edit the password (and `MONGODB_URI` if you use Atlas) at the top of `start-windows.bat`.
3. Double-click `start-windows.bat`. The first run installs packages, then opens `http://localhost:3000/admin`.

### Any OS, from a terminal
```bash
cp server/.env.example server/.env   # then edit it
npm install                          # installs server packages
npm start                            # http://localhost:3000  →  redirects to /admin
```

### Server (Ubuntu/Debian)
```bash
sudo bash deploy.sh
```
Installs Node.js, MongoDB 8.0 (or uses your Atlas URI), Caddy for HTTPS, a systemd service and a nightly `mongodump` backup.

## Moving from the old data.json

The first time the server starts with an **empty** MongoDB database it imports `server/data/legacy-data.json` (or the file in `LEGACY_DATA_FILE`): accounts, stats, brand logo and the session secret. Images are moved out of the JSON into the `media` collection. To import a file by hand:

```bash
npm run migrate -- path/to/data.json
```

Existing accounts (same id) are skipped, so running it twice is safe.

## Environment variables (`server/.env`)

| Name | Default | |
|---|---|---|
| `PORT` | `3000` | |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/sbpo-link-tree` | Local MongoDB or Atlas connection string |
| `MONGODB_DB` | database in the URI | Override the database name |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `admin` / random (printed on start) | Admin login |
| `TRUST_PROXY` | off | Set to `1` behind Caddy/Nginx |
| `LEGACY_DATA_FILE` | `server/data/legacy-data.json` | Old database to import into an empty MongoDB |

## URLs

| URL | |
|---|---|
| `/` | Redirects to `/admin` |
| `/admin` | Admin app (login page when signed out) |
| `/<slug>` | Public profile page |
| `/n/<slug>` | Same page, counted as an NFC tap (write this to the card) |
| `/go/<account>/<link>` | Tracked redirect for a link button |
| `/media/<id>` | Uploaded image |
| `/api/...` | Admin JSON API (requires login) |

## Tests

```bash
npm test
```
Runs the API end to end (login, import, create/edit/delete, tracking, logo placement) against an in-memory stand-in, so no MongoDB is needed.
