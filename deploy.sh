#!/usr/bin/env bash
# One-command install for a fresh Ubuntu/Debian server. Run as root from the project folder:  sudo bash deploy.sh
# Before running: point your domain's A record at this server's IP.
# Installs Node.js 20, MongoDB 8.0 (unless you give an Atlas connection string) and Caddy (automatic HTTPS).
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run with sudo"; exit 1; }
cd "$(dirname "$0")"
[ -f server/src/index.js ] && [ -f client/package.json ] || { echo "Run this from the project folder (the one containing client/ and server/)"; exit 1; }

read -rp "Your domain (e.g. card.yourcompany.com): " DOMAIN
read -rp "Admin username [admin]: " AUSER; AUSER=${AUSER:-admin}
read -rsp "Admin password (long!): " APASS; echo
[ ${#APASS} -ge 8 ] || { echo "Password must be at least 8 characters"; exit 1; }
read -rp "MongoDB connection string [leave empty to install MongoDB on this server]: " MURI

APP=/opt/linkforge DATA=/var/lib/linkforge
. /etc/os-release

apt-get update -y
apt-get install -y curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https rsync

# --- Node.js ---
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# --- MongoDB (local) ---
if [ -z "$MURI" ]; then
  if ! command -v mongod >/dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg --dearmor --yes -o /usr/share/keyrings/mongodb-server-8.0.gpg
    if [ "$ID" = debian ]; then
      echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/debian $VERSION_CODENAME/mongodb-org/8.0 main" > /etc/apt/sources.list.d/mongodb-org-8.0.list
    else
      echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu $VERSION_CODENAME/mongodb-org/8.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-8.0.list
    fi
    apt-get update -y && apt-get install -y mongodb-org
  fi
  systemctl enable --now mongod
  MURI="mongodb://127.0.0.1:27017/sbpo-link-tree"
fi

# --- Caddy (HTTPS reverse proxy) ---
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

# --- App ---
mkdir -p "$APP" "$DATA"
rsync -a --delete --exclude node_modules --exclude .env --exclude /client/dist client server package.json "$APP/"
npm install --prefix "$APP/server" --omit=dev
# Build the React admin app into client/dist (served at /admin)
npm install --prefix "$APP/client"
npm run build --prefix "$APP/client"

# An old single-file install (data.json) is imported automatically the first time MongoDB is empty.
LEGACY="$APP/server/data/legacy-data.json"
[ -f "$DATA/data.json" ] && LEGACY="$DATA/data.json"

cat > /etc/linkforge.env <<EOF
PORT=3000
TRUST_PROXY=1
ADMIN_USER=$AUSER
ADMIN_PASSWORD=$APASS
MONGODB_URI=$MURI
LEGACY_DATA_FILE=$LEGACY
EOF
chmod 600 /etc/linkforge.env

cat > /etc/systemd/system/linkforge.service <<EOF
[Unit]
Description=SBPO Link Tree
After=network.target mongod.service
[Service]
WorkingDirectory=$APP/server
EnvironmentFile=/etc/linkforge.env
ExecStart=$(command -v node) src/index.js
Restart=always
[Install]
WantedBy=multi-user.target
EOF

printf '%s {\n    reverse_proxy localhost:3000\n}\n' "$DOMAIN" > /etc/caddy/Caddyfile
(command -v ufw >/dev/null && ufw allow 80,443/tcp >/dev/null) || true

# Nightly database backup (one file per weekday, kept for a week) when MongoDB runs on this server.
if command -v mongodump >/dev/null && [[ "$MURI" == mongodb://127.0.0.1* ]]; then
  echo "0 3 * * * root mongodump --uri='$MURI' --gzip --archive=$DATA/backup-\$(date +\%a).gz >/dev/null 2>&1" > /etc/cron.d/linkforge-backup
fi

systemctl daemon-reload
systemctl enable --now linkforge
systemctl restart linkforge
systemctl restart caddy
echo; echo "Done. Open https://$DOMAIN/admin  (the certificate can take a minute)"
echo "NFC link format: https://$DOMAIN/n/<account-slug>"
