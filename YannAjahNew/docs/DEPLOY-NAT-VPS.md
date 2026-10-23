# YannAjahNew di VPS NAT (pola sama dengan CDN APIZ2Z)

Polanya sama persis dengan `deploy/cdn-vps.md` di root repo: VPS NAT tidak butuh port 80/443 karena
koneksi masuk lewat **Cloudflare Tunnel**, dan database ada di **Neon**.

```
Admin (browser) → https://lisensi.apiz2z.web.id (Cloudflare) → tunnel → VPS :8787 (dashboard + API lisensi) → Neon
Bot WhatsApp (di VPS yang sama)  → koneksi KELUAR ke WhatsApp, APIZ2Z, dan http://127.0.0.1:8787
```

Bot WhatsApp hanya butuh koneksi keluar, jadi aman di VPS NAT. Yang perlu diakses dari luar hanya dashboard.

## 0. Cek VPS dulu

| Syarat | Kenapa |
|---|---|
| RAM **≥ 2 GB** (kalau satu VPS dengan CDN, hitung total) | Bot ±128 MB sebelum konek WhatsApp + socket WhatsApp + dashboard ±70 MB + ffmpeg saat bikin stiker |
| Akses root, Ubuntu/Debian, bisa install `ffmpeg` | Stiker & efek audio |
| IPv4 keluar (bukan IPv6-only) | WhatsApp & APIZ2Z |
| Boleh proses jalan 24/7 | Bot & dashboard selalu hidup (bot berhenti sendiri kalau dashboard mati) |

Cek RAM yang tersisa kalau dipakai bareng CDN: `free -m` dan `pm2 monit`.

## 1. Database di Neon (BUKAN database APIZ2Z)

Buat **project baru** di Neon (mis. `yannajah`), jangan pakai database platform APIZ2Z.
Salin *Connection string* → jadi `DATABASE_URL` (jangan dikirim ke chat).

## 2. Siapin VPS

```bash
apt update && apt install -y curl git ffmpeg
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -     # Node 22 (minimal 20)
apt install -y nodejs
npm install -g pm2          # kalau sudah ada dari CDN, lewati

git clone https://github.com/Yannz2zWorld/api-docs.git /opt/yannajah
# repo private? username GitHub + Personal Access Token (Contents: Read-only), sama seperti CDN
cd /opt/yannajah/YannAjahNew
npm ci --omit=dev
```

## 3. Isi `.env`

```bash
cd /opt/yannajah/YannAjahNew
cp .env.example .env && chmod 600 .env && nano .env
```

Yang wajib diisi (nilai rahasia **jangan** dikirim ke chat):

```
NODE_ENV=production
DATABASE_URL=postgresql://...            # dari Neon project yannajah
DASHBOARD_HOST=127.0.0.1
DASHBOARD_PORT=8787                      # beda dengan CDN (3000)
DASHBOARD_PUBLIC_URL=https://lisensi.apiz2z.web.id
DASHBOARD_TRUST_PROXY=true
SESSION_SECRET=...                       # openssl rand -hex 32
BACKUP_ENCRYPTION_KEY=...                # teks acak ≥ 16 karakter, simpan juga di tempat lain
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://lisensi.apiz2z.web.id/auth/google/callback

LICENSE_SERVER_URL=http://127.0.0.1:8787  # bot & dashboard satu VPS: lewat localhost
OWNER_NUMBER=628xxxxxxxxxx
APIZ2Z_API_KEY=...
```

`LICENSE_SERVER_URL` boleh `http://127.0.0.1` karena tidak keluar dari VPS. Bot di VPS lain harus pakai `https://lisensi.apiz2z.web.id`.

## 4. Database + akun pertama + dashboard

```bash
npm run migrate
node server/cli.js bootstrap-developer --username yann --email emailkamu@gmail.com
pm2 start server/index.js --name yannajah-dashboard
curl http://127.0.0.1:8787/health/ready     # harus {"status":"ready",...}
```

## 5. Cloudflare Tunnel

Domain `apiz2z.web.id` sudah ada di Cloudflare (dari setup CDN).

- **Pakai tunnel CDN yang sudah ada** (paling gampang): Zero Trust → Networks → Tunnels → tunnel `yannz-cdn`
  → **Public Hostname** → *Add a public hostname*: Subdomain `lisensi`, Domain `apiz2z.web.id`,
  Service **HTTP** → `localhost:8787`.
- Atau buat tunnel baru `yannajah` kalau dashboard di VPS lain.

Cek: buka `https://lisensi.apiz2z.web.id/` → halaman login YannAjahNew.

## 6. Google OAuth

Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** → Web application.
- Authorized JavaScript origins: `https://lisensi.apiz2z.web.id`
- Authorized redirect URIs: `https://lisensi.apiz2z.web.id/auth/google/callback`

Isi Client ID/Secret ke `.env`, lalu `pm2 restart yannajah-dashboard`.
Sebelum OAuth jadi, login sementara: `node server/cli.js login-link --username yann`.

## 7. Daftarkan nomor bot & jalankan bot

1. Dashboard → **Bot** → *Tambah bot*: nama, nomor WhatsApp bot, password bot.
2. Login + pairing pertama **interaktif** di SSH:
   ```bash
   cd /opt/yannajah/YannAjahNew
   npm run start:pairing        # atau npm run start:qr
   ```
   Isi nomor bot + password bot, masukkan pairing code di HP (WhatsApp → Perangkat tertaut →
   Tautkan dengan nomor telepon). Setelah terhubung, tekan Ctrl+C.
3. Jalankan permanen (token tersimpan, tidak minta password lagi):
   ```bash
   pm2 start index.js --name yannajah-bot --stop-exit-codes 78 --exp-backoff-restart-delay=5000
   pm2 save && pm2 startup
   ```
   Exit code 78 = ditolak lisensi / perlu pairing ulang → pm2 tidak restart terus-menerus.

## Update kode

```bash
cd /opt/yannajah && git pull && cd YannAjahNew && npm ci --omit=dev && npm run migrate \
  && pm2 restart yannajah-dashboard && pm2 restart yannajah-bot
```

## Backup

- Database: Neon punya restore point bawaan; tambahan backup terenkripsi:
  `node server/cli.js backup --out /root/backup/yannajah-$(date +%F).json.enc` (cron harian, salin keluar VPS).
- Folder `YannAjahNew/session/` = login WhatsApp bot. Backup terenkripsi, jangan dibagikan.

## Catatan

- Dashboard mati = bot berhenti (gagal aman). Pantau `https://lisensi.apiz2z.web.id/health/ready` (mis. UptimeRobot gratis).
- Kalau VPS mati, data akun/bot aman di Neon; session WhatsApp ada di VPS (makanya dibackup).
- Satu proses bot = satu nomor. Nomor kedua: folder/clone kedua dengan `SESSION_DIR`, `BOT_INSTANCE_NAME` berbeda.
