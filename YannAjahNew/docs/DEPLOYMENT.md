# Deployment, VPS, hardening, operasi

> **Tidak ada pembelian / pendaftaran layanan berbayar yang dilakukan.** Semua harga di bawah adalah **perkiraan** dari sumber publik pihak ketiga yang saling tidak konsisten; cek halaman harga resmi sebelum membeli.

## 1. Audit kebutuhan

| Komponen | Harus online 24/7? | Ukuran nyata yang terukur di container ini | Catatan |
|---|---|---|---|
| Proses bot (per nomor WhatsApp) | Ya | ±128 MB RSS setelah semua modul + 1.933 entri registry dimuat, **sebelum** socket WhatsApp terbuka | Socket, cache pesan & metadata grup menambah memori — belum terukur karena server WhatsApp tidak terjangkau dari container. Ukur di VPS: `pm2 monit` / `ps -o rss` |
| ffmpeg (stiker, efek audio) | Saat dipakai | proses terpisah, singkat (timeout 90 dtk) | Lonjakan CPU per permintaan media; dibatasi cooldown & concurrency (`concurrency.globalCommands`) |
| Backend + dashboard | Ya (bot heartbeat ke sini; jika mati bot **terkunci**) | ±68 MB RSS idle | Ringan; beban = login + heartbeat tiap 10 menit per bot |
| PostgreSQL | Ya | — | Data kecil (akun, bot, audit). Bisa lokal di VPS atau managed (Neon) |
| APIZ2Z | Eksternal | — | Bergantung kuota API key |

Belum ada angka beban nyata (jumlah user/command per menit). Asumsi untuk perkiraan: 1–5 nomor bot aktif, ratusan command/jam. Cara mengukur setelah live: `npm run features:report` untuk statistik fitur, `GET /api/dash/health` (memori proses backend), `stats.totalCommands` di database lokal bot, dan metrik VPS (CPU/RAM/disk).

Perkiraan kasar (bukan benchmark): RAM ≈ 300 MB OS + 70 MB backend + PostgreSQL ±150 MB + (±200–300 MB × jumlah nomor bot) + cadangan untuk ffmpeg.

## 2. Rekomendasi

### Opsi A — ekonomis untuk mulai production (1–3 nomor bot)
- **2 vCPU, 4 GB RAM, 40–60 GB SSD/NVMe**, trafik tanpa kuota ketat, Ubuntu 24.04 LTS.
- Semua dalam satu VPS: bot + backend/dashboard + PostgreSQL lokal (port 5432 **tidak** dibuka ke internet).
- Perkiraan biaya: kira-kira **Rp90.000 – Rp560.000/bulan** tergantung penyedia & lini paket (IDCloudHost/Biznet Gio, sumber: [CekVPS](https://cekvps.com/), [Biznet Gio pricelist](https://www.biznetgio.com/pricelist), [Biznet Gio NEO Lite](https://www.biznetgio.com/product/neo-lite)); penyedia luar negeri (Hetzner CX23 / CPX22) ±€4–€20/bulan menurut sumber yang tidak konsisten ([agentdeals](https://agentdeals.dev/hetzner-pricing-2026), [kimmo.suominen.com](https://kimmo.suominen.com/stuff/cpc-2026-08.txt)). Lokasi Indonesia memberi latensi lebih rendah ke WhatsApp/pengguna lokal.
- Backup: `pg_dump` harian + backup terenkripsi bawaan ke penyimpanan terpisah (mis. object storage / Google Drive pribadi).
- Keterbatasan: satu titik gagal (VPS mati = bot & lisensi mati). Upgrade jika RAM terpakai > 75% atau > 3 nomor bot.

### Opsi B — siap tumbuh (5–15 nomor bot)
- **4 vCPU, 8 GB RAM, 80+ GB NVMe** untuk bot + backend; database **managed** (mis. Neon, yang sudah dipakai platform APIZ2Z) atau VPS database kecil terpisah di jaringan privat.
- Perkiraan biaya: VPS ±Rp300.000 – Rp1.000.000/bulan + database managed (ada paket gratis dengan batas; paket berbayar mulai puluhan USD/bulan) — **verifikasi** di situs penyedia.
- Monitoring eksternal (uptime check ke `/health/ready`), alert email/Telegram.
- Kapan perlu VPS kedua: > 15 nomor bot atau CPU rata-rata > 60%. Bot bisa dipindah per proses ke VPS lain karena lisensi terpusat.

### Keputusan arsitektur
- **Development lokal sudah cukup** untuk mencoba dashboard, test, dan bot (pairing butuh ponsel + internet).
- **VPS diperlukan** jika bot & dashboard harus online 24/7 — hosting panel (Pterodactyl) juga bisa untuk bot, tetapi backend lisensi butuh HTTPS publik yang stabil.
- Satu VPS cukup di tahap awal. **Redis, queue, load balancer, Kubernetes tidak diperlukan** sekarang: state antrian kecil dan per-proses; rate limiter backend in-memory cukup untuk satu instance backend (jika backend diperbanyak, pindahkan rate limit ke database/Redis).
- Jangan menaruh tabel YannAjahNew di database production platform APIZ2Z; buat database/project terpisah.

## 3. Setup production (Ubuntu)

```bash
# 1. Paket dasar
sudo apt update && sudo apt install -y git ffmpeg postgresql nginx ufw
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2

# 2. User & database (password kuat, hak minimum: pemilik schema aplikasi saja)
sudo -u postgres psql -c "CREATE ROLE yannajah_app LOGIN PASSWORD '...';"
sudo -u postgres psql -c "CREATE DATABASE yannajah OWNER yannajah_app;"

# 3. Aplikasi (user non-root)
sudo adduser --disabled-password yannajah && sudo -iu yannajah
git clone <repo> && cd api-docs/YannAjahNew && npm ci --omit=dev
cp .env.example .env && chmod 600 .env && nano .env      # isi semua secret
npm run migrate
node server/cli.js bootstrap-developer --username kamu --email kamu@gmail.com

# 4. Proses (pm2). Bot exit code 78 = ditolak lisensi/config: jangan restart terus-menerus.
pm2 start server/index.js --name yannajah-dashboard
pm2 start index.js --name yannajah-bot --stop-exit-codes 78 --exp-backoff-restart-delay=5000
pm2 save && pm2 startup
```
Login bot pertama kali dilakukan interaktif (`node index.js`, isi nomor bot + password bot, scan QR / masukkan pairing code), lalu hentikan dan jalankan lewat pm2 — token tersimpan, tidak perlu password lagi selama sesi sah.

**Nginx (HTTPS)**: reverse proxy `https://lisensi.domainkamu.com` → `127.0.0.1:8787`, sertifikat dari Let's Encrypt (`certbot --nginx`). Set `DASHBOARD_TRUST_PROXY=true`, `DASHBOARD_PUBLIC_URL=https://…`, `NODE_ENV=production` (server menolak start tanpa `SESSION_SECRET` ≥ 32 karakter dan URL https).

**Firewall**: `ufw allow OpenSSH; ufw allow 80,443/tcp; ufw enable`. Port 5432 & 8787 hanya localhost. SSH: login kunci saja (`PasswordAuthentication no`), nonaktifkan root login.

**Google OAuth**: Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application). Authorized redirect URI: `https://lisensi.domainkamu.com/auth/google/callback`. Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`.

## 4. Operasi

- **Health**: `GET /health` (proses hidup), `GET /health/ready` (DB + migrasi). Pasang uptime monitor ke `/health/ready`.
- **Log**: bot → `library/database/logs/yannajah.log` (redaksi otomatis token/password/key). Rotasi: `pm2 install pm2-logrotate` atau logrotate untuk file log bot.
- **Monitoring**: `pm2 monit`, metrik CPU/RAM/disk penyedia VPS, tab *Sistem* di dashboard (DEVELOPER/OWNER/CEO).
- **Backup terjadwal** (cron harian, simpan 14 hari di luar server):
  `pg_dump -Fc "$DATABASE_URL" > /backup/yannajah-$(date +\%F).dump` dan `node server/cli.js backup --out /backup/yannajah-$(date +\%F).json.enc`.
  Backup juga folder `session/` bot (berisi kredensial WhatsApp → enkripsi, simpan privat).
  **Uji restore** berkala ke database baru (prosedur di `docs/DATABASE.md`).
- **Update**: `git pull` → `npm ci --omit=dev` → `npm test` (di staging) → `npm run migrate` → `pm2 reload yannajah-dashboard` → `pm2 restart yannajah-bot`.
- **Rollback**: `git checkout <tag sebelumnya>` → `npm ci` → restart. Jika migrasi baru sudah diterapkan dan bermasalah: pulihkan dump sebelum update ke database baru lalu arahkan `DATABASE_URL` (jangan menghapus data di database produksi).
- **Pencabutan akses**: dashboard → Bot → *Ban* / *Disable* / *Cabut sesi* / *Password* (rotasi), Akun → *Ban/Suspend*. Efek ke proses bot paling lambat satu interval heartbeat (default 10 menit; atur `LICENSE_HEARTBEAT_MINUTES`).
- **Environment terpisah**: `.env` berbeda untuk development/production; test memakai `TEST_DATABASE_URL` dengan schema sekali pakai.

## 5. Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| Bot keluar dengan kode 78 | Ditolak server lisensi (password salah, bot banned/disabled, akun tidak aktif) atau konfigurasi tidak valid — baca pesan di terminal |
| `Server lisensi tidak bisa dihubungi` | Backend mati / URL salah / HTTPS. Bot sengaja tidak jalan (gagal aman). Opsional `LICENSE_OFFLINE_GRACE_MINUTES` |
| `Bot ini sedang dipakai oleh proses lain` | Proses lama masih hidup. Matikan, atau login dengan pilihan ambil alih |
| `Session WhatsApp ini sedang dipakai proses lain` | Dua proses memakai folder `SESSION_DIR` yang sama |
| QR terus kedaluwarsa | Scan lebih cepat / pakai pairing code (`npm run start:pairing`) |
| `Nomor WhatsApp yang ditautkan BUKAN nomor bot terdaftar` | Tautkan dengan nomor yang sama dengan di dashboard |
| Fitur APIZ2Z menjawab butuh API key | Isi `APIZ2Z_API_KEY` |
| `ffmpeg belum terpasang` | `sudo apt install ffmpeg` atau set `FFMPEG_PATH` |
| Dashboard `CSRF_FAILED` | Muat ulang halaman (token CSRF terikat ke sesi) |
