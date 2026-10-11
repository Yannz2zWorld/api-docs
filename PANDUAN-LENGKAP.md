# Panduan Lengkap Yannz API — Isi Web, Kebutuhan, dan Cara Setup dari Nol

File ini adalah "mentahan" web **Yannz API** (apiz2z.web.id): isinya apa saja, butuh layanan apa,
dan langkah setup dari nol sampai online, termasuk CDN di VPS. Pakai file ini kalau mau bikin web
seperti ini lagi (mis. dengan nama/domain lain).

> **Aturan emas:** API key, password, token, dan connection string **tidak pernah** ditulis di
> kode atau di file ini. Semuanya disimpan sebagai **Environment Variable** (Vercel / `.env` di VPS).

---

## Daftar isi

1. [Web ini apa](#1-web-ini-apa)
2. [Cara kerja (arsitektur)](#2-cara-kerja-arsitektur)
3. [Yang dibutuhkan (akun & biaya)](#3-yang-dibutuhkan-akun--biaya)
4. [Struktur folder](#4-struktur-folder)
5. [Daftar Environment Variable](#5-daftar-environment-variable)
6. [Setup dari nol, langkah demi langkah](#6-setup-dari-nol-langkah-demi-langkah)
7. [Tier, kuota, dan API key](#7-tier-kuota-dan-api-key)
8. [Developer panel (/owner)](#8-developer-panel-owner)
9. [Cara menambah endpoint](#9-cara-menambah-endpoint)
10. [CDN: upload file sampai 200 MB](#10-cdn-upload-file-sampai-200-mb)
11. [Ganti nama, logo, dan tampilan](#11-ganti-nama-logo-dan-tampilan)
12. [Jalankan & tes di komputer sendiri](#12-jalankan--tes-di-komputer-sendiri)
13. [Cek setelah deploy](#13-cek-setelah-deploy)
14. [Masalah yang sering muncul](#14-masalah-yang-sering-muncul)
15. [Perawatan rutin & keamanan](#15-perawatan-rutin--keamanan)
16. [Checklist bikin web baru dari mentahan ini](#16-checklist-bikin-web-baru-dari-mentahan-ini)

---

## 1. Web ini apa

**Yannz API** adalah platform REST API (gaya "API publik" seperti BotcahX/NexRay) dengan akun,
kuota, paket berbayar, dan panel developer. Fiturnya:

| Bagian | Isi |
|---|---|
| **Login** | Google (Google Identity Services) dan email + password (kode verifikasi lewat email), Turnstile anti-bot |
| **Dashboard** (`/home`) | Statistik, endpoint terakhir dibuka, monitor status endpoint, live chat, pengumuman, musik |
| **API Docs** (`/api`) & **Playground** | Daftar ratusan endpoint per kategori, form tes langsung, contoh kode cURL/Node.js/Python/PHP |
| **API Keys** (`/keys`) | Bikin/cabut key, key custom, batas jumlah key per tier |
| **Pricing & Billing** (`/pricing`, `/billing`) | Paket FREE/SULTAN/SEPUH/DEWA, bayar QRIS (Pakasir) atau manual + upload bukti |
| **Profile** (`/profile`) | ID numerik, nama, avatar, ganti password |
| **CDN** (`/upload`) | Upload file (≤ 4 MB di database, sampai 200 MB ke Backblaze B2), link `cdn.<domain>/cdn/<id>` |
| **Custom UI** (`/custom-ui`) | Tema/warna tampilan per akun |
| **Developer panel** (`/owner`) | Kelola user, key, endpoint (tier, lock, label, edit, tes, tambah lewat AI), pembayaran, error, backup, CDN, server/maintenance |
| **Bahasa** | Indonesia (bawaan) + English (`views/i18n-en.json`) |

Endpoint API berasal dari: **plugin lokal** (`plugin/*.js`) dan **server upstream** (theresav,
dongtube, botcahx, nexray, clutch, termai, dll) yang diproksikan. Nama/brand upstream tidak pernah
tampil ke pengguna, dan kalau satu upstream mati otomatis pindah ke cadangan (failover).

---

## 2. Cara kerja (arsitektur)

```
                    ┌──────────────────────────── Vercel ─────────────────────────────┐
Browser / Bot  ───▶ │ index.js (Express)                                               │
                    │  ├─ routes/auth.js      login Google & email                     │
                    │  ├─ routes/platform.js  halaman, keys, billing, owner, CDN       │
                    │  ├─ API gateway         cek key/sesi → tier → kuota → plugin     │
                    │  └─ plugin/*.js         endpoint (lokal / proxy ke upstream)     │
                    └───────┬───────────────┬──────────────────┬─────────────────────┘
                            │               │                  │
                   Neon Postgres     Upstream API        Backblaze B2 (file CDN besar)
                   (user, key,      (theresav, nexray,          ▲
                    kuota, order,    botcahx, dll)              │ ambil file utuh
                    file CDN kecil)                    ┌────────┴─────────┐
                                                        │ VPS (cdn-server) │◀── https://cdn.<domain>
                                                        └──────────────────┘
Pembayaran: Pakasir (QRIS) ──webhook──▶ /webhooks/pakasir
Email: SMTP Gmail / Resend      Cron Vercel: backup harian + cek endpoint harian
```

- **Vercel** menjalankan web utama (Node.js 20+, Express). Batas Vercel: ~4,5 MB per request/respons.
- **Neon** = database PostgreSQL (gratis cukup).
- **Backblaze B2** = penyimpanan file CDN besar (gratis 10 GB, bucket private, tanpa kartu).
- **VPS** (opsional) menjalankan `cdn-server.js` supaya file besar dikirim utuh (tanpa batas Vercel).

---

## 3. Yang dibutuhkan (akun & biaya)

| Layanan | Untuk apa | Wajib? | Biaya |
|---|---|---|---|
| **GitHub** | Simpan kode, Vercel deploy otomatis dari sini | Wajib | Gratis |
| **Vercel** | Hosting web utama + cron | Wajib | Gratis (Hobby) |
| **Neon** (neon.tech) | Database PostgreSQL | Wajib | Gratis |
| **Domain** (Hostinger, dll) | Alamat web, mis. `apiz2z.web.id` | Disarankan | ± Rp10–150rb/tahun |
| **Google Cloud Console** | OAuth Client ID untuk login Google | Wajib (kalau login Google) | Gratis |
| **Gmail App Password** / Resend | Kirim kode verifikasi & reset password | Disarankan | Gratis |
| **Cloudflare Turnstile** | Anti-bot di login/daftar | Opsional | Gratis |
| **Pakasir** | Pembayaran QRIS otomatis | Opsional (bisa manual) | Potongan per transaksi |
| **Backblaze B2** | File CDN > 4 MB | Opsional | Gratis 10 GB |
| **VPS** (mis. Nauval Cloud) | CDN kirim file utuh | Opsional | ± Rp15–30rb/bulan |
| **API key upstream** | Endpoint theresav/dongtube/botcahx/clutch/termai | Sesuai endpoint | Tergantung penyedia |
| **AI gateway** (mis. KryptonLab / Anthropic) | Fitur "Tambah endpoint pakai AI" di panel | Opsional | Berbayar per pemakaian |

Alat di HP/PC: browser, **Termius** atau **Termux** (SSH ke VPS), dan (kalau di PC) Node.js 20 + Git.

---

## 4. Struktur folder

```
index.js              Server utama: middleware, API gateway, loader plugin, halaman, CDN
cdn-server.js         Server CDN khusus VPS (file utuh)
settings.js           Nama web, kreator, link sosmed (tampil di web)
vercel.json           Konfigurasi Vercel + jadwal cron
routes/
  auth.js             Login Google, email+password, logout, reset password
  platform.js         Halaman, keys, billing/order, profile, chat, CDN, Developer panel
services/             Logika per fitur (user, tier, kuota, key, order, Pakasir, email,
                      CDN, backup, cek endpoint, failover, error log, AI builder, dll)
lib/
  db.js               Koneksi Neon/Postgres
  apiproxy.js         makeEndpoint(): bikin endpoint proxy ke server upstream
  theresav.js         Endpoint khusus server theresav
  r2.js               Penyimpanan B2/R2 (S3-compatible): presign upload, baca, hapus, CORS
config/
  apiServers.js       Daftar server upstream + nama env API key-nya
  endpointGroups.js   Grup failover: endpoint utama + cadangan
plugin/               Semua endpoint (1 file = 1 atau banyak endpoint)
views/                HTML/JS/CSS semua halaman + i18n-en.json (terjemahan)
migrations/           File SQL database (001 … 025), dijalankan berurutan
deploy/cdn-vps.md     Panduan CDN di VPS
tests/                Tes otomatis (node --test)
```

---

## 5. Daftar Environment Variable

Isi di **Vercel → Project → Settings → Environment Variables** (Production + Preview).
Yang rahasia centang **Sensitive**. Setelah menambah/mengubah, **Redeploy**.

### Wajib

| Nama | Isi |
|---|---|
| `DATABASE_URL` | Connection string Neon (`postgresql://…?sslmode=require`) — **Sensitive** |
| `AUTH_SECRET` | String acak panjang (≥ 32 karakter) untuk enkripsi sesi — **Sensitive** |
| `OWNER_EMAIL` | Email akun developer/owner (dapat akses `/owner`) |
| `PUBLIC_BASE_URL` | Alamat web, mis. `https://apiz2z.web.id` |
| `GOOGLE_CLIENT_ID` | OAuth Client ID dari Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Pasangannya — **Sensitive** |
| `GOOGLE_CALLBACK_URL` | `https://<domain>/auth/google/callback` |

### Email (kode verifikasi & reset password)

| Nama | Isi |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Gmail: `smtp.gmail.com`, `465`, `true` |
| `SMTP_USER` | Alamat Gmail pengirim |
| `SMTP_PASS` | **App Password** Gmail (bukan password biasa) — **Sensitive** |
| `EMAIL_FROM` | Nama pengirim, mis. `YannApi <emailmu@gmail.com>` |
| `RESEND_API_KEY` | Alternatif SMTP (opsional) |

### Keamanan & akses

| Nama | Isi |
|---|---|
| `CORS_ORIGINS` | Semua domain web dipisah koma, mis. `https://apiz2z.web.id,https://apiz2z.vercel.app` |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile (opsional) |
| `HUMAN_CHECK` | `off` untuk mematikan cek "bukan robot" (default nyala) |
| `MEDIA_SECRET` | Opsional; default pakai `AUTH_SECRET` |
| `RATE_LIMIT_PER_MINUTE`, `AUTH_RATE_LIMIT_PER_15MIN`, `INVALID_KEY_LIMIT_PER_15MIN` | Opsional, batas request |

### Pembayaran

| Nama | Isi |
|---|---|
| `PAYMENT_GATEWAY` | `pakasir` untuk QRIS otomatis |
| `PAKASIR_PROJECT` | Slug project di Pakasir |
| `PAKASIR_API_KEY` | API key Pakasir — **Sensitive** |
| `PAKASIR_WEBHOOK_SECRET` | Rahasia webhook — **Sensitive** |
| `PAKASIR_SANDBOX` | `true` untuk mode tes |
| `MANUAL_PAYMENT_INSTRUCTIONS` | Teks instruksi bayar manual (opsional) |
| `OWNER_WA` | Nomor WA owner untuk notifikasi pembeli (format 62…) |

### API key server upstream (isi yang dipakai saja)

| Nama | Server |
|---|---|
| `THERESAV_API_KEY` | api.theresav.eu |
| `DONGTUBE_API_KEY` | api.dongtube.id |
| `BOTCAHX_API_KEY` | api.botcahx.eu.org |
| `CLUTCH_API_KEY` | api.clutch.web.id |
| `TERMAI_API_KEY` | api.termai.cc |
| `PITUCODE_API_KEY` | api.pitucode.com |
| `NEXRAY` | isi `off` untuk mematikan endpoint NexRay (tanpa key) |

### CDN (upload file besar)

| Nama | Isi |
|---|---|
| `S3_ENDPOINT` | Endpoint B2, mis. `https://s3.us-east-005.backblazeb2.com` |
| `S3_BUCKET` | Nama bucket, mis. `webcdn22` |
| `S3_ACCESS_KEY_ID` | keyID Application Key B2 — **Sensitive** |
| `S3_SECRET_ACCESS_KEY` | applicationKey B2 — **Sensitive** |
| `S3_PUBLIC_URL` | Kosongkan (bucket private) |
| `S3_REGION` | Opsional (dibaca otomatis dari endpoint) |
| `CDN_PUBLIC_URL` | Alamat CDN VPS, mis. `https://cdn.apiz2z.web.id` (kosong = pakai domain utama) |
| `CDN_ACCOUNT_LIMIT_MB` | Batas file aktif per akun (default 2048, `0` = tanpa batas) |
| `CDN_CATBOX` | `off` (catbox sudah tidak menerima upload) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | Alternatif: Cloudflare R2 (butuh kartu) |

### Fitur lain

| Nama | Isi |
|---|---|
| `CRON_SECRET` | Rahasia untuk `/cron/backup` & `/cron/endpoint-check` — **Sensitive** |
| `BACKUP_EMAIL` | Gmail penerima backup harian |
| `GITHUB_TOKEN` | Token GitHub (Contents: Read & Write) — tambah/edit endpoint dari panel — **Sensitive** |
| `GITHUB_REPO`, `GITHUB_BRANCH` | Repo `owner/nama` & branch (default repo ini, `main`) |
| `AI_API_KEY` | Key AI untuk "Tambah endpoint pakai AI" — **Sensitive** |
| `AI_BASE_URL` | Gateway AI (kosong = Anthropic langsung; mis. `https://api.kryptonlab.id`) |
| `AI_MODEL` | Nama model di gateway |
| `SITE_MUSIC_URL`, `SITE_MUSIC_TITLE`, `SITE_MUSIC_ARTIST` | Musik latar dashboard (opsional) |

---

## 6. Setup dari nol, langkah demi langkah

### 6.1 Kode di GitHub
1. Fork/copy repo ini ke akun GitHub kamu (bisa private).
2. Ubah `settings.js` (nama web, kreator, link sosmed) — lihat [bagian 11](#11-ganti-nama-logo-dan-tampilan).

### 6.2 Database Neon
1. Daftar di **https://console.neon.tech** → **New Project** (region Singapore).
2. Buka **SQL Editor**, jalankan file di `migrations/` **berurutan**: `001_users.sql` → … → `025_endpoint_edits.sql`
   (copy isi file → paste → Run). Semua aman dijalankan ulang (tidak menghapus data).
3. Klik **Connect** → salin **Connection string** (pooling nyala) → ini `DATABASE_URL`.

### 6.3 Login Google
1. **https://console.cloud.google.com** → buat project → **APIs & Services → OAuth consent screen**
   (External, isi nama app & email) → **Credentials → Create OAuth client ID** (Web application).
2. **Authorized JavaScript origins**: `https://<domain>` (+ `https://<project>.vercel.app`).
3. **Authorized redirect URIs**: `https://<domain>/auth/google/callback`.
4. Salin **Client ID** & **Client Secret** → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

### 6.4 Email (Gmail)
1. Akun Google → **Keamanan** → nyalakan **Verifikasi 2 Langkah** → **App Passwords** → buat satu.
2. Isi `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`.

### 6.5 Deploy ke Vercel
1. **https://vercel.com** → **Add New → Project** → import repo GitHub. Framework: **Other/Express**.
2. Isi semua env [bagian 5](#5-daftar-environment-variable) (minimal yang **Wajib**).
3. **Deploy**. Cek `https://<project>.vercel.app/health` → `{"status":"ok"}` dan
   `/health/database` → `{"database":"connected","schema":"ok"}`.
4. Cron di `vercel.json` (backup jam 19:00 UTC, cek endpoint 18:00 UTC) jalan otomatis kalau `CRON_SECRET` diisi.

### 6.6 Domain
1. Vercel → Project → **Settings → Domains** → tambah domain.
2. Di tempat beli domain, ganti **nameserver** ke `ns1.vercel-dns.com` / `ns2.vercel-dns.com`
   (atau ikuti record A/CNAME yang diminta Vercel).
3. Update `PUBLIC_BASE_URL`, `CORS_ORIGINS`, `GOOGLE_CALLBACK_URL`, dan origin/redirect di Google Cloud. Redeploy.

### 6.7 Masuk sebagai developer
Login pakai email yang sama dengan `OWNER_EMAIL` → buka `/owner`. Tab **Status** harus menunjukkan
schema ok dan konfigurasi yang terisi.

### 6.8 Pembayaran (opsional)
- **Manual**: atur rekening/QRIS di Developer panel → **Server & Pembayaran**; pembeli upload bukti, owner approve.
- **Pakasir (QRIS otomatis)**: daftar di pakasir.com → buat project → isi `PAYMENT_GATEWAY=pakasir`,
  `PAKASIR_PROJECT`, `PAKASIR_API_KEY`, `PAKASIR_WEBHOOK_SECRET`; set webhook ke `https://<domain>/webhooks/pakasir`.
  Tes di panel (tombol tes Pakasir).

### 6.9 Endpoint upstream
Isi API key server yang mau dipakai (tabel "API key server upstream"). Endpoint yang key-nya kosong
otomatis disembunyikan/ditandai belum aktif. Cek di panel → **Test/Check All API**.

### 6.10 Fitur tambahan (opsional)
- `GITHUB_TOKEN` → tambah/edit/hapus endpoint langsung dari panel (commit ke GitHub, Vercel redeploy).
- `AI_API_KEY` (+ `AI_BASE_URL`, `AI_MODEL`) → "Tambah endpoint" dari kode bot WA pakai AI.
- `BACKUP_EMAIL` + `CRON_SECRET` → backup harian ke Gmail.
- CDN besar → [bagian 10](#10-cdn-upload-file-sampai-200-mb).

---

## 7. Tier, kuota, dan API key

Diatur di `services/tierService.js`:

| Tier | Harga/bulan | Request per hari | Maks API key |
|---|---|---|---|
| FREE | Rp0 | 100 | 0 (pakai sesi login) |
| SULTAN | Rp5.000 | 1.000 | 2 |
| SEPUH | Rp10.000 | 10.000 | 3 |
| DEWA | Rp25.000 | 100.000 | tanpa batas |
| OWNER | – | tanpa batas | tanpa batas |

- Kuota reset harian; request gagal (≥ 400) tidak memotong kuota.
- Panggil API: header `Authorization: Bearer <key>` (atau `x-api-key`), atau sesi login dari web.
- Owner bisa bikin key khusus (public/private/owner, tier & masa aktif sendiri) di panel.

---

## 8. Developer panel (/owner)

| Tab | Fungsi |
|---|---|
| Status | Cek database, schema, env yang terisi |
| Dashboard | Ringkasan user, request, pendapatan |
| Users | Cari, ban/unban, ganti tier, reset password, hapus |
| API Keys | Semua key, bikin key khusus |
| Endpoints | Tier minimum, label (New/Hot/Recommend), Lock, Disable, **Edit** (nama/path/kategori), **Tes** (tanpa key, tampil gambar/video/JSON), **Tampilkan** cadangan sebagai versi (V2, V3…), **Tambah endpoint** (tempel kode → disempurnakan otomatis/AI → tes → deploy), Test/Check All API |
| Error | Error endpoint dari upstream; endpoint yang gagal terus disembunyikan otomatis |
| Payments | Approve/reject pembayaran, lihat bukti |
| Server & Pembayaran | Maintenance, pengumuman, rekening, tes Pakasir |
| Activity / Audit | Log aktivitas & tindakan admin |
| CDN | Daftar file, hapus (ikut terhapus dari B2), info penyimpanan, **Pasang izin upload** (CORS bucket) |
| Backup | Kirim backup ke Gmail sekarang |

---

## 9. Cara menambah endpoint

### A. Lewat Developer panel (paling gampang)
Endpoints → **Tambah endpoint** → tempel kode (plugin, kode bot WA `case`, atau fetch biasa) →
**Sempurnakan & tes** → cek hasil → **Tambah & deploy**. Butuh `GITHUB_TOKEN` (dan `AI_API_KEY` untuk mode AI).

### B. Plugin manual (`plugin/nama.js`)
```js
module.exports = {
  name: 'Ping',
  desc: 'Cek API key dan sisa kuota.',
  category: 'Tools',
  path: '/api/tools/ping',
  params: [{ name: 'q', required: true, placeholder: 'contoh' }],  // opsional, untuk form Docs
  async run(req, res) {
    // req.query = parameter, req.apiAuth = { tier, keyId, quota } (sudah dicek gateway)
    res.json({ status: true, result: { pong: true } });
  }
};
```
File bisa export satu objek atau array. Gateway (auth, tier, kuota) jalan otomatis sebelum `run()`.

### C. Proxy ke server upstream (`lib/apiproxy.js`)
1. Daftarkan server di `config/apiServers.js`: `{ base, keyEnv: 'NAMA_API_KEY', keyMode: 'query', keyName: 'apikey' }`.
2. Di plugin:
```js
const { makeEndpoint } = require('../lib/apiproxy');
module.exports = [
  makeEndpoint({ server: 'botcahx', category: 'Search', name: 'Google', desc: 'Cari di Google.',
    path: '/api/search/google', upstream: '/api/search/google',
    params: [{ name: 'q', required: true }], rename: { q: 'text1' }, sample: { q: 'kucing' } })
];
```
3. Endpoint cadangan: `backupOnly: true` dengan path `/api/altN/...`, lalu daftarkan di
   `config/endpointGroups.js` (`{ path: '/api/utama', backups: ['/api/alt2/...'] }`).
4. Isi env API key-nya di Vercel → redeploy.

---

## 10. CDN: upload file sampai 200 MB

Alur: browser upload **langsung** ke Backblaze B2 (tidak lewat Vercel) → link `https://cdn.<domain>/cdn/<id>`
dilayani VPS yang mengambil file dari B2 dan mengirimnya **utuh**.

### 10.1 Backblaze B2 (tanpa kartu)
1. Daftar **backblaze.com** → B2 Cloud Storage → **Create a Bucket** → **Private**.
2. **Application Keys → Add a New Application Key** → *All buckets*, *Read and Write* → salin keyID &
   applicationKey (cuma muncul sekali). **Jangan pakai Master Key** (S3 API menolaknya).
3. Bucket → **Lifecycle Settings** → **Keep only the last version** (file terhapus benar-benar hilang).
4. Isi env `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` di Vercel → redeploy.
5. Developer panel → CDN → **Pasang izin upload** (server mengatur CORS bucket otomatis).

Tanpa VPS pun sudah jalan: file besar dikirim Vercel per potongan 4 MB (video tetap bisa diputar).

### 10.2 VPS untuk kirim file utuh (detail: `deploy/cdn-vps.md`)
1. Beli VPS Ubuntu 24.04 (contoh dipakai: **Nauval Cloud**, NAT, Jakarta, ± Rp20–30rb/bulan).
2. SSH (Termius/Termux): `ssh root@<IP> -p <PORT>` → ganti password: `passwd`.
3. Install:
   ```bash
   apt update && apt install -y curl git
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   apt install -y nodejs && npm install -g pm2
   git clone https://github.com/<user>/<repo>.git /opt/yannz-cdn
   cd /opt/yannz-cdn && npm ci --omit=dev
   ```
4. `nano .env` →
   ```
   PORT=3000
   DATABASE_URL=...        (dari Neon)
   S3_ENDPOINT=https://s3.us-east-005.backblazeb2.com
   S3_BUCKET=...
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   ```
   lalu `chmod 600 .env`.
5. Jalankan: `pm2 start cdn-server.js --name yannz-cdn && pm2 save && pm2 startup`.
   Cek `curl http://127.0.0.1:3000/` → `{"status":true,"service":"cdn","database":true}`.
6. DNS: tambah record **A** `cdn` → IP publik VPS (di Vercel → Domains → DNS Records kalau nameserver Vercel).
7. Panel VPS → **Managed Domain**: `cdn.<domain>` → port `3000` (SSL otomatis).
   VPS tanpa fitur ini: pakai Cloudflare Tunnel (lihat `deploy/cdn-vps.md`).
8. Vercel env `CDN_PUBLIC_URL=https://cdn.<domain>` → redeploy.
9. Update kode di VPS: `cd /opt/yannz-cdn && git pull && npm ci --omit=dev && pm2 restart yannz-cdn`.

---

## 11. Ganti nama, logo, dan tampilan

| Yang diganti | Di mana |
|---|---|
| Nama web, kreator, link WA/IG/Telegram/GitHub, email, channel WA (tombol logo WhatsApp di kiri bawah: `whatsappChannelLink`) | `settings.js` |
| Favicon & logo | `views/assets/favicon.png`, `apple-touch-icon.png` |
| Warna, font, tema | `views/theme.css`, `views/ui-theme.js` |
| Teks halaman | file `views/*.html` |
| Terjemahan English | `views/i18n-en.json` (setiap teks baru tambahkan di sini) |
| Harga & kuota tier | `services/tierService.js` |
| Musik dashboard | env `SITE_MUSIC_*` atau `views/assets/site-music.mp3` |

Gaya tulisan web: bahasa santai, semua teks diterjemahkan kecuali path endpoint, nama upstream tidak pernah tampil.

---

## 12. Jalankan & tes di komputer sendiri

```bash
npm install
cp .env.example .env   # atau bikin .env sendiri berisi env bagian 5
npm run dev            # http://localhost:3000
npm run lint
npm test               # tes integrasi butuh TEST_DATABASE_URL (Postgres kosong, BUKAN produksi)
TEST_DATABASE_URL=postgresql://user@host/db npm run test:integration
```
Untuk login Google lokal, tambahkan `http://localhost:3000` di Authorized JavaScript origins.

---

## 13. Cek setelah deploy

- `/health` → `{"status":"ok"}`; `/health/database` → `schema: ok`.
- Login Google & email berhasil; `/auth/me` tanpa login → 401.
- `/api` → jalankan **Ping** → 200, kuota berkurang 1.
- `/keys` (tier berbayar) → bikin key → `curl -H "Authorization: Bearer <key>" https://<domain>/api/tools/ping`.
- `/billing` → tes beli (sandbox/manual) → approve di panel → tier aktif.
- `/upload` → upload file > 4 MB → link `cdn.<domain>` bisa dibuka.
- `/owner` → Status hijau; non-owner dapat 403.

---

## 14. Masalah yang sering muncul

| Gejala | Penyebab & solusi |
|---|---|
| `DATABASE_SCHEMA_OUTDATED` / `MIGRATION_REQUIRED` | Migrasi belum dijalankan → jalankan file `migrations/` yang kurang di Neon |
| Login Google `AUDIENCE_MISMATCH` | `GOOGLE_CLIENT_ID` beda dengan yang di Google Cloud / domain belum ditambah ke origins |
| Email kode tidak sampai | `SMTP_PASS` harus App Password Gmail; cek folder spam |
| Upload > 4 MB gagal | Env `S3_*` belum diisi / belum klik **Pasang izin upload** / CORS bucket |
| `Invalid uploader` (catbox) | Catbox menolak upload → pakai B2, set `CDN_CATBOX=off` |
| Video CDN tidak bisa diputar | Cache browser → buka di Incognito / hapus data browsing; cek `curl -I` dari VPS |
| Endpoint hilang dari daftar | Upstream error terus → lihat tab **Error**; isi/ganti API key server itu |
| Perubahan env tidak berlaku | Harus **Redeploy** setelah ubah env di Vercel |
| CDN VPS mati | SSH ke VPS → `pm2 status` / `pm2 restart yannz-cdn` / `pm2 logs yannz-cdn` |

---

## 15. Perawatan rutin & keamanan

- **Jangan pernah** taruh key/password di kode, chat, atau screenshot. Kalau bocor → **ganti/rotate** langsung.
- Tandai semua env rahasia **Sensitive** di Vercel.
- Backup: aktifkan `BACKUP_EMAIL` + `CRON_SECRET`; sebelum migrasi besar bikin branch/backup di Neon.
- VPS: ganti password root (`passwd`), bersihkan bulanan:
  `apt clean && npm cache clean --force && pm2 flush && journalctl --vacuum-size=50M`,
  pasang rotasi log sekali: `pm2 install pm2-logrotate`. Nyalakan Auto-Renew VPS.
- Patuhi aturan VPS (Nauval: dilarang mining, Pterodactyl, VPN/proxy, DDoS, scanning, phishing, spam, malware).
- Pantau kuota gratis: Neon (storage/compute), B2 (10 GB, batas download harian), Vercel (bandwidth).

---

## 16. Checklist bikin web baru dari mentahan ini

- [ ] Copy repo ke GitHub baru
- [ ] Ubah `settings.js`, logo, warna, teks
- [ ] Neon project baru → jalankan semua migrasi → `DATABASE_URL`
- [ ] Google OAuth client baru (origins + redirect domain baru)
- [ ] Gmail App Password → env SMTP
- [ ] Vercel project baru → isi env → deploy → `/health/database` ok
- [ ] Domain → Vercel, update `PUBLIC_BASE_URL`, `CORS_ORIGINS`, `GOOGLE_CALLBACK_URL`
- [ ] Login dengan `OWNER_EMAIL` → cek `/owner`
- [ ] API key upstream yang dipakai
- [ ] (Opsional) Pakasir, Turnstile, GitHub token, AI key, backup email
- [ ] (Opsional) B2 + VPS CDN + `CDN_PUBLIC_URL`
- [ ] Jalankan cek [bagian 13](#13-cek-setelah-deploy)
