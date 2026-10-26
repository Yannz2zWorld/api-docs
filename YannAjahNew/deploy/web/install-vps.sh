#!/usr/bin/env bash
# YannAjah Web Database — pemasang otomatis untuk VPS Ubuntu 22.04 / 24.04 (jalankan sebagai root).
#
#   bash install-vps.sh --domain lisensi.domainkamu.com --email kamu@gmail.com
#   bash install-vps.sh --domain lisensi.domainkamu.com --managed-domain        (VPS NAT, SSL dari panel)
#   bash install-vps.sh --domain ... --database-url 'postgresql://...neon.tech/yannajah?sslmode=require'
#
# Yang dilakukan:
#   1. Node.js 22 + pm2 (kalau belum ada)
#   2. PostgreSQL lokal + database & user khusus (dilewati kalau --database-url diisi, mis. Neon)
#   3. .env dengan SESSION_SECRET & BACKUP_ENCRYPTION_KEY acak (file lama tidak ditimpa)
#   4. npm install, migrasi database, akun DEVELOPER pertama + password
#   5. pm2 (auto start saat reboot) + nginx & HTTPS (certbot) kecuali --managed-domain
# Aman dijalankan ulang (update): langkah yang sudah selesai dilewati.
set -euo pipefail

DOMAIN=""; EMAIL=""; DATABASE_URL_ARG=""; MANAGED=0; PORT=8787
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --database-url) DATABASE_URL_ARG="$2"; shift 2 ;;
    --managed-domain) MANAGED=1; shift ;;
    --port) PORT="$2"; shift 2 ;;
    *) echo "Opsi tidak dikenal: $1"; exit 1 ;;
  esac
done

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"
say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✖ %s\033[0m\n' "$*"; exit 1; }

[[ $EUID -eq 0 ]] || die "Jalankan sebagai root (sudo bash install-vps.sh ...)"
[[ -n "$DOMAIN" ]] || die "Wajib: --domain lisensi.domainkamu.com"
[[ -f server/index.js ]] || die "Jalankan dari dalam folder YannAjah-WebDatabase"

say "1/6 Node.js & pm2"
apt-get update -y >/dev/null
apt-get install -y curl ca-certificates gnupg openssl >/dev/null
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/' || echo 0)
if [[ "${NODE_MAJOR:-0}" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
fi
command -v pm2 >/dev/null || npm install -g pm2 >/dev/null
echo "node $(node -v), pm2 $(pm2 -v)"

say "2/6 Database"
if [[ -n "$DATABASE_URL_ARG" ]]; then
  DB_URL="$DATABASE_URL_ARG"
  echo "Memakai database dari --database-url"
elif grep -q '^DATABASE_URL=postgres' .env 2>/dev/null && ! grep -q 'GANTI_PASSWORD' .env; then
  DB_URL="$(grep '^DATABASE_URL=' .env | cut -d= -f2-)"
  echo "Memakai DATABASE_URL yang sudah ada di .env"
else
  apt-get install -y postgresql >/dev/null
  systemctl enable --now postgresql >/dev/null
  DB_PASS="$(openssl rand -hex 24)"
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='yannajah_app'" | grep -q 1; then
    sudo -u postgres psql -qc "ALTER ROLE yannajah_app WITH LOGIN PASSWORD '${DB_PASS}'"
  else
    sudo -u postgres psql -qc "CREATE ROLE yannajah_app WITH LOGIN PASSWORD '${DB_PASS}'"
  fi
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='yannajah'" | grep -q 1 \
    || sudo -u postgres psql -qc "CREATE DATABASE yannajah OWNER yannajah_app"
  DB_URL="postgres://yannajah_app:${DB_PASS}@127.0.0.1:5432/yannajah"
  echo "PostgreSQL lokal siap (database yannajah, user yannajah_app; hanya bisa diakses dari VPS ini)"
fi

say "3/6 File .env"
HOST=127.0.0.1; [[ $MANAGED -eq 1 ]] && HOST=0.0.0.0
if [[ ! -f .env ]]; then
  cat > .env <<ENV
NODE_ENV=production
DATABASE_URL=${DB_URL}
DASHBOARD_HOST=${HOST}
DASHBOARD_PORT=${PORT}
DASHBOARD_PUBLIC_URL=https://${DOMAIN}
DASHBOARD_TRUST_PROXY=true
SESSION_SECRET=$(openssl rand -hex 32)
BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 24)
ENV
  echo ".env dibuat (secret acak). SIMPAN salinan BACKUP_ENCRYPTION_KEY di tempat aman."
else
  sed -i "s#^DATABASE_URL=.*#DATABASE_URL=${DB_URL}#" .env
  echo ".env sudah ada — hanya DATABASE_URL yang diperbarui"
fi
chmod 600 .env

say "4/6 Install dependency & migrasi database"
npm install --omit=dev --no-audit --no-fund >/dev/null
node server/cli.js migrate
if node server/cli.js status 2>/dev/null | grep -q 'developer: 0'; then NEED_DEV=1; else NEED_DEV=0; fi
if [[ $NEED_DEV -eq 1 ]]; then
  read -rp "Username DEVELOPER (bebas, mis. yann): " DEV_USER
  node server/cli.js bootstrap-developer --username "$DEV_USER"
  node server/cli.js set-password --username "$DEV_USER"
fi

say "5/6 pm2 (jalan otomatis saat VPS reboot)"
pm2 startOrReload ecosystem.config.js --update-env
pm2 save >/dev/null
pm2 startup systemd -u root --hp /root >/dev/null || true

say "6/6 Domain & HTTPS"
if [[ $MANAGED -eq 1 ]]; then
  echo "Mode Managed Domain: arahkan ${DOMAIN} ke port ${PORT} VPS ini di panel provider (SSL dari panel)."
else
  apt-get install -y nginx certbot python3-certbot-nginx >/dev/null
  sed "s/DOMAIN_KAMU/${DOMAIN}/g; s/127.0.0.1:8787/127.0.0.1:${PORT}/" nginx-yannajah.conf > /etc/nginx/sites-available/yannajah
  ln -sf /etc/nginx/sites-available/yannajah /etc/nginx/sites-enabled/yannajah
  nginx -t && systemctl reload nginx
  if command -v ufw >/dev/null; then ufw allow 'Nginx Full' >/dev/null || true; fi
  if [[ -n "$EMAIL" ]]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || echo "certbot gagal: pastikan DNS ${DOMAIN} sudah mengarah ke IP VPS ini, lalu jalankan ulang skrip."
  else
    echo "Lewati HTTPS (tanpa --email). Jalankan: certbot --nginx -d ${DOMAIN}"
  fi
fi

sleep 2
if curl -fsS "http://127.0.0.1:${PORT}/health/ready" >/dev/null; then
  printf '\n\033[1;32m✔ Web database jalan.\033[0m Buka https://%s lalu login dengan akun DEVELOPER.\n' "$DOMAIN"
else
  printf '\n\033[1;31m✖ Web database belum siap.\033[0m Cek: pm2 logs yannajah-web\n'
fi
echo "Perintah berguna: pm2 logs yannajah-web | pm2 restart yannajah-web | node server/cli.js status"
