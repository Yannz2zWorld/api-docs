# YannAjah Web Database — pasang di VPS

Web database = website dashboard (login username + password) + API lisensi yang dipakai semua bot.
Isinya: akun (Reseller/Suki/King/CEO/Developer), nomor bot, password bot, ban, maintenance.

## Kebutuhan

- VPS **Ubuntu 22.04/24.04**, RAM **1 GB** (cukup 512 MB kalau database di Neon), akses root.
- Domain/subdomain, mis. `lisensi.domainkamu.com`, record **A** mengarah ke IP VPS
  (VPS NAT: pakai fitur **Managed Domain** di panel provider ke port 8787).
- Database: **PostgreSQL lokal** (dipasang otomatis) atau **Neon** (gratis, https://neon.tech).

## Pasang (sekali jalan)

```bash
# upload YannAjah-WebDatabase.zip ke VPS, lalu:
apt install -y unzip && unzip YannAjah-WebDatabase.zip -d /opt && cd /opt/YannAjah-WebDatabase

# VPS biasa (nginx + HTTPS Let's Encrypt otomatis):
bash install-vps.sh --domain lisensi.domainkamu.com --email kamu@gmail.com

# VPS NAT + Managed Domain (SSL dari panel provider):
bash install-vps.sh --domain lisensi.domainkamu.com --managed-domain

# Pakai Neon, bukan PostgreSQL lokal: tambahkan
#   --database-url 'postgresql://user:pass@ep-xxx.neon.tech/yannajah?sslmode=require'
```

Skrip menanyakan **username Developer** dan **password**-nya, lalu web jalan di pm2 (`yannajah-web`).
Buka `https://lisensi.domainkamu.com` → login.

## Setelah jalan

1. Menu **Akun**: buat akun Reseller/Suki/King/CEO (username & password bebas) untuk pembeli.
2. Menu **Bot**: tambah nomor bot, lalu (Developer) **Password** → tetapkan password bot.
3. Berikan `YannAjah-AI.zip` + nomor & password bot ke pembeli. Bot dijalankan di panel
   (lihat `PANDUAN-PANEL.md` di paket bot).
4. Menu **Maintenance**: maintenance web (web hanya untuk Developer + semua bot berhenti),
   maintenance global, atau per bot dari menu Bot.

## Perintah

| Perlu | Perintah (di `/opt/YannAjah-WebDatabase`) |
|---|---|
| Log | `pm2 logs yannajah-web` |
| Restart | `pm2 restart yannajah-web` |
| Status migrasi / jumlah akun | `node server/cli.js status` |
| Lupa password web | `node server/cli.js set-password --username yann` |
| Link login darurat (15 menit) | `node server/cli.js login-link --username yann` |
| Backup terenkripsi | `node server/cli.js backup --out /root/yannajah-$(date +%F).json.enc` |
| Update versi baru | ekstrak zip baru di atas folder lama (`.env` tetap), lalu `bash install-vps.sh --domain ...` |

Health check: `https://lisensi.domainkamu.com/health/ready` (200 = web & database sehat).
Kalau PostgreSQL mati, API membalas `503 DATABASE_UNAVAILABLE` dan semua bot berhenti dengan
error di console sampai database hidup lagi.
