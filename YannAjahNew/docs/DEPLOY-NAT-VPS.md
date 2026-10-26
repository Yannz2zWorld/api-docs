# YannAjahNew di VPS NAT (VPS yang sama dengan CDN APIZ2Z)

Disesuaikan dengan VPS yang sudah dipakai CDN (`deploy/cdn-vps.md`, `PANDUAN-LENGKAP.md` bagian 10.2):
**Nauval Cloud, NAT VPS (LXC), Ubuntu 24.04**, Node.js + pm2 sudah terpasang, domain lewat panel **Managed Domain** (SSL otomatis).

```
Admin (browser HP/PC) → https://lisensi.apiz2z.web.id → panel Managed Domain (SSL) → VPS :8787 (dashboard + API lisensi) → Neon
Bot WhatsApp (di VPS yang sama) → koneksi KELUAR ke WhatsApp & APIZ2Z, lisensi lewat http://127.0.0.1:8787
CDN yang sudah ada tetap di :3000 (tidak terganggu)
```

Bot WhatsApp hanya butuh koneksi keluar, jadi aman di VPS NAT. Yang diakses dari luar hanya dashboard.

## 0. Cek dulu

| Syarat | Cara cek |
|---|---|
| RAM cukup (bot + dashboard + CDN) — sisakan **±700 MB** untuk YannAjahNew | `free -m`, `pm2 monit` |
| Disk cukup (node_modules ±250 MB + session + log) | `df -h` |
| ffmpeg bisa dipasang (LXC biasanya bisa) | `apt install -y ffmpeg && ffmpeg -version` |
| Node.js ≥ 20 (CDN memakai 20 — cukup) | `node -v` |

### Aturan provider yang relevan

| Aturan | Status YannAjahNew |
|---|---|
| CPU total tidak boleh >100% terus-menerus | ffmpeg diantrikan (`MEDIA_MAX_CONCURRENT=1`, `FFMPEG_THREADS=1`), cooldown & limit per user, anti-spam. Jangan naikkan angka ini di VPS bersama |
| Spam | Fitur broadcast massal (jpm, pushkontak, nglspam, kirim ke nomor sembarang) **tidak ada** — dinonaktifkan |
| Phishing / malware / scanning / DDoS / proxy / VPN / mining | Tidak ada fitur seperti itu |
| Pterodactyl | Tidak dipakai (pm2 biasa) |
| Bypass token AI | Fitur AI memakai API key APIZ2Z resmi milik Anda |

Aturan bisa berubah — cek halaman Terms/Rules di panel, termasuk apakah **bot WhatsApp** diizinkan.

## 1. Database: project Neon baru

Neon → **New Project** `yannajah` (jangan pakai database APIZ2Z) → salin *Connection string* untuk `DATABASE_URL`.
Postgres tidak dipasang di VPS supaya RAM & CPU hemat.

## 2. Ambil kode

YannAjahNew punya repo sendiri (`Yannz2zWorld/YannzAiBotNew`), terpisah dari CDN/APIZ2Z:

```bash
apt install -y ffmpeg
git clone https://github.com/Yannz2zWorld/YannzAiBotNew.git /opt/yannajah
cd /opt/yannajah
npm ci --omit=dev
```
(Repo private: username GitHub + Personal Access Token, sama seperti saat pasang CDN.)

## 3. `.env`

```bash
cd /opt/yannajah && cp .env.example .env && chmod 600 .env && nano .env
```

Isi (nilai rahasia **jangan** dikirim ke chat):

```
NODE_ENV=production
DATABASE_URL=postgresql://...             # Neon project yannajah
DASHBOARD_HOST=0.0.0.0                    # supaya bisa dijangkau Managed Domain (sama seperti CDN)
DASHBOARD_PORT=8787                       # beda dengan CDN (3000)
DASHBOARD_PUBLIC_URL=https://lisensi.apiz2z.web.id
DASHBOARD_TRUST_PROXY=true
SESSION_SECRET=...                        # openssl rand -hex 32
BACKUP_ENCRYPTION_KEY=...                 # teks acak ≥ 16 karakter, simpan juga di tempat lain

LICENSE_SERVER_URL=http://127.0.0.1:8787  # bot & dashboard satu VPS
OWNER_NUMBER=628xxxxxxxxxx
APIZ2Z_API_KEY=...
MEDIA_MAX_CONCURRENT=1
FFMPEG_THREADS=1
```

## 4. Database + akun pertama + dashboard

```bash
npm run migrate
node server/cli.js bootstrap-developer --username yann --email emailkamu@gmail.com
node server/cli.js set-password --username yann     # password login website (ketik tersembunyi)
pm2 start server/index.js --name yannajah-dashboard
curl http://127.0.0.1:8787/health/ready      # harus {"status":"ready",...}
```

## 5. Domain (sama seperti `cdn`)

1. DNS: tambah record **A** `lisensi` → IP publik VPS (di Vercel → Domains → DNS Records, karena nameserver di Vercel).
2. Panel VPS → **Managed Domain**: `lisensi.apiz2z.web.id` → port `8787` (SSL otomatis).
3. Cek: buka `https://lisensi.apiz2z.web.id/` dari HP → halaman login YannAjahNew.

VPS tanpa Managed Domain: pakai Cloudflare Tunnel ke `localhost:8787` (lihat `deploy/cdn-vps.md` bagian 4) dan `DASHBOARD_HOST=127.0.0.1`.

## 6. Login website

Buka `https://lisensi.apiz2z.web.id/` → masuk dengan **username/email + password** dari langkah 4.
Buat akun pembeli di menu **Akun** (username + password + rank), lalu berikan username & password itu ke pembeli.

Tidak ada login Google — hanya username/email + password.
Darurat (lupa password): `node server/cli.js set-password --username yann` di server, atau `login-link --username yann` (link sekali pakai 15 menit).

## 7. Daftarkan nomor bot & jalankan bot

1. Dashboard → **Bot** → *Tambah bot*: nama, nomor WhatsApp bot, password bot.
2. Login + pairing pertama di SSH (Termius/Termux):
   ```bash
   cd /opt/yannajah
   npm run start:pairing
   ```
   Isi nomor bot + password bot → kode pairing muncul → di HP nomor bot: WhatsApp → Perangkat tertaut →
   Tautkan perangkat → **Tautkan dengan nomor telepon** → masukkan kode. Setelah "WhatsApp terhubung", Ctrl+C.
3. Jalankan permanen (token tersimpan, tidak minta password lagi):
   ```bash
   pm2 start yannajah.js --name yannajah-bot --stop-exit-codes 78 --exp-backoff-restart-delay=5000
   pm2 save
   ```
   Exit code 78 = ditolak lisensi / perlu pairing ulang → pm2 tidak restart terus-menerus.

## Update kode

```bash
cd /opt/yannajah && git pull && npm ci --omit=dev && npm run migrate \
  && pm2 restart yannajah-dashboard && pm2 restart yannajah-bot
```

## Perawatan (sama seperti CDN)

```bash
apt clean && npm cache clean --force && pm2 flush && journalctl --vacuum-size=50M   # bersihkan disk
pm2 install pm2-logrotate                                                            # sekali saja (kalau belum dari CDN)
```
- Log bot: `/opt/yannajah/library/database/logs/yannajah.log` — kosongkan berkala bila besar: `truncate -s 0 <file>`.
- Nyalakan **Auto-Renew** di panel VPS (VPS mati = dashboard mati = bot berhenti, gagal aman).
- Pantau `https://lisensi.apiz2z.web.id/health/ready` (mis. UptimeRobot gratis).

## Backup

- Database: Neon punya restore point bawaan; tambahan backup terenkripsi:
  `node server/cli.js backup --out /root/backup/yannajah-$(date +%F).json.enc` → salin keluar VPS.
- Folder `YannAjahNew/session/` = login WhatsApp bot. Backup terenkripsi, jangan dibagikan.

## Catatan

- Kalau VPS mati, data akun/bot aman di Neon; session WhatsApp ada di VPS (makanya dibackup).
- Satu proses bot = satu nomor. Nomor kedua: folder/clone kedua dengan `SESSION_DIR` & `BOT_INSTANCE_NAME` berbeda — hitung RAM & CPU dulu.
