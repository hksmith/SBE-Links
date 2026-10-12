# SBPO Link Tree

Multi-account link-in-bio pages for NFC business cards, with tap/click analytics.

- **client/** – the admin web app (**React + Vite**), built into `client/dist` and served at `/admin`
- **server/** – Node.js API, public profile pages and redirects, data stored in **MongoDB**

## Project structure

```
sbpo-link-tree/
├── client/                     Admin web app – React 19 + Vite (built into client/dist, served under /admin)
│   ├── index.html              App shell (shown when signed in)
│   ├── login.html              Sign-in page
│   ├── vite.config.js          Build settings + dev-server proxy to the API
│   ├── public/assets/          Favicon (copied as-is into the build)
│   └── src/
│       ├── main.jsx            Admin app entry      · login.jsx  Sign-in page entry
│       ├── App.jsx             Loads the signed-in user, picks the screen from the #route
│       ├── AppContext.js       Signed-in user, role, brand logo
│       ├── styles/             admin.css, login.css (unchanged look)
│       ├── lib/                api (fetch wrapper), router (#/ routes), constants (themes, fonts, blocks),
│       │                       icons, toast, utils
│       ├── components/         Dialog (+ confirmDialog/showDialog), Modal, Menu, Icon, CopyButton, TopBar, Toasts
│       ├── views/              Dashboard, Users, StatsView (viewers), Analytics, accountActions (new/delete account)
│       └── editor/             Editor screen, useEditor (autosave, undo, preview, uploads), BioTab (blocks, links,
│                               icon picker), DesignTab, fields (inputs bound to the account), useDragSort
├── server/
│   ├── src/
│   │   ├── index.js            Entry point: connect MongoDB, import old data, start HTTP
│   │   ├── app.js              Request handler + route registration
│   │   ├── config.js           Settings from environment / server/.env
│   │   ├── db/                 MongoDB connection, collections, indexes
│   │   ├── repositories/       accounts, events (+stats), media, settings, users
│   │   ├── services/           auth (sign-in + roles), render (public page), sanitize, stats, media, vcard, brand, migrate
│   │   ├── routes/             admin.js, api.js, public.js
│   │   ├── lib/                http helpers, tiny router
│   │   └── data/icons.js       SVG icon set
│   ├── scripts/migrate-json.js Import an old data.json by hand
│   ├── data/legacy-data.json   Your previous data.json (imported automatically on first start)
│   ├── test/                   API tests (run against an in-memory MongoDB stand-in)
│   └── .env.example
├── start-windows.bat           Double-click to run on Windows (builds the admin app the first time)
├── deploy.sh                   One-command install on an Ubuntu/Debian server
└── package.json                Convenience scripts (npm install / npm run build / npm start from the root)
```

## MongoDB collections

| Collection | What it holds |
|---|---|
| `accounts` | One document per person (`_id` = account id, unique `slug`), profile, theme, blocks |
| `events` | Every page view and link click (`a` account, `k` view/click, `src`, `dev`, `t`) |
| `stats` | Running totals per account so the dashboard loads instantly |
| `media` | Uploaded images (photos, logos, gallery, icons), referenced as `/media/<id>` |
| `settings` | Branding (footer logo, its size, footer text) and the session-signing secret |
| `users` | People who can sign in besides the main admin: role (`admin` / `viewer`), which cards a viewer can see, hashed password |

## Running it

You need **Node.js 18+**, **npm** and **MongoDB** (local MongoDB Community Server, or a free MongoDB Atlas cluster).

### Windows
1. Install Node.js LTS and MongoDB Community Server (leave “Install as a service” ticked).
2. Edit the password (and `MONGODB_URI` if you use Atlas) at the top of `start-windows.bat`.
3. Double-click `start-windows.bat`. The first run installs packages and builds the admin app, then opens `http://localhost:3000/admin`.

### Any OS, from a terminal
```bash
cp server/.env.example server/.env   # then edit it
npm install                          # installs server + client packages
npm run build                        # builds the React admin app into client/dist
npm start                            # http://localhost:3000  →  redirects to /admin
```
(`npm start` also builds the admin app automatically if `client/dist` is missing.)

After changing anything in `client/src`, run `npm run build` again and reload the page.

### Working on the admin app (hot reload)
```bash
npm run dev          # terminal 1: the API server on :3000
npm run dev:client   # terminal 2: Vite on http://localhost:5173/admin/  (API calls are proxied to :3000)
```
Sign in at `http://localhost:5173/admin/login.html`. Edits in `client/src` show up instantly.

### Server (Ubuntu/Debian)
```bash
sudo bash deploy.sh
```
Installs Node.js, MongoDB 8.0 (or uses your Atlas URI), Caddy for HTTPS, a systemd service and a nightly `mongodump` backup, and builds the admin app.

## Users and permissions

The **main admin** comes from `ADMIN_USER` / `ADMIN_PASSWORD` in `server/.env`. It always works and always has full access.

Signed in as an admin, click **Users** in the top bar to add more people:

| Role | Can do |
|---|---|
| **Admin** | Everything: create, edit and delete cards, design, footer & branding, users |
| **Viewer** | Only sees statistics (dashboard totals and each card's Analytics). No editing, no creating, no deleting, no settings. Can be limited to **all cards** or **only selected cards**. |

The rules are enforced by the server, not just hidden in the screen: a viewer gets `403` from every route that changes something, and `404` for cards they were not given.
### Card owners see their own statistics

Every card can have its own **view-only sign-in** for the person it belongs to, so you don't have to add users by hand:

- **New account** has a tick box (on by default): *Let them see their own statistics*. It creates a viewer whose **username is the card's page address** (e.g. `yiha-yimam`), who can see **only that card**, with the shared first-time password from `DEFAULT_USER_PASSWORD` in `server/.env` (default `Welcome@123`). A box then shows the sign-in details with a **Copy message** button to send to the person.
- The first time they sign in with that password they must **choose their own password** before they can see anything (the server refuses everything else until they do, and won't accept the shared password as the new one).
- **Users → Create sign-ins for N cards without one** does the same for cards made earlier. Running it again skips cards that already have one.
- **Users → Reset password** puts someone back on the shared first-time password (signed out at once, must choose a new one again). Card owners who haven't signed in yet show **Not signed in yet**.
- Deleting a card also deletes its owner's sign-in.

Changing someone's role takes effect immediately; changing their password signs them out everywhere. Everyone except the main admin can change their own password from the menu under their name.

## Footer & branding

On the dashboard, the **Footer & branding** card (admins) sets what appears at the bottom of every link tree page, the admin pages and the sign-in page:

- **Footer logo**: any size or shape; it is scaled to fit. **Logo size in footer** sets its height (12–60 px).
- **Footer text**: “Powered by Shaggar BPO Enterprise” by default. Change it to anything, or leave it empty to show only the logo.

Changes show in the preview first and apply everywhere when you click **Save footer**.

## “Save My Contact” on Android

Chrome on Android always downloads a vCard first — no website can jump straight into the Contacts app. What decides whether the phone then offers **Add contact** is how the file is sent. Files hosted on Google Drive, Dropbox or most websites arrive as a generic download (or an HTML page), so they just sit in Downloads.

So the button now always goes through this server (`/vcf/<account>/<block>`), which sends the vCard as `text/x-vcard` with a `.vcf` file name:

- **Upload a .vcf file** in the Save contact block (recommended), or
- **paste a link**: the server fetches it (Google Drive / Dropbox / OneDrive share links are converted to direct downloads), checks it really is a vCard and passes it on with the right headers. If it cannot be read, the button falls back to opening the link as before.

On Android the visitor then taps **Open** on Chrome’s download message and lands on the import / add-contact screen; the page shows a short hint saying exactly that. On iPhone the contact card opens directly.

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
| `DEFAULT_USER_PASSWORD` | `Welcome@123` | Shared first-time password for card owners' view-only sign-ins (they must change it on first sign-in) |
| `TRUST_PROXY` | off | Set to `1` behind Caddy/Nginx |
| `LEGACY_DATA_FILE` | `server/data/legacy-data.json` | Old database to import into an empty MongoDB |
| `CLIENT_DIR` | `client/dist` | Folder with the built admin app |

## URLs

| URL | |
|---|---|
| `/` | Redirects to `/admin` |
| `/admin` | Admin app (login page when signed out). Screens: `#/`, `#/users`, `#/edit/<id>`, `#/stats/<id>` |
| `/<slug>` | Public profile page |
| `/n/<slug>` | Same page, counted as an NFC tap (write this to the card) |
| `/go/<account>/<link>` | Tracked redirect for a link button |
| `/vcf/<account>/<block>` | “Save My Contact”: the vCard with contact headers (counted as a click) |
| `/media/<id>` | Uploaded image |
| `/api/...` | Admin JSON API (requires login) |

## Tests

```bash
npm test
```
Runs the API end to end (login, import, create/edit/delete, tracking, logo placement, user roles and permissions, vCard serving) against an in-memory stand-in, so no MongoDB is needed.
