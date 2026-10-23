# YannAjahNew

Bot WhatsApp modular dengan namespace `yannajah`, autentikasi bot ke **backend pusat** (nomor bot + password bot), **dashboard admin** dengan login Google, **6 rank** dengan kuota, ban/unban & maintenance yang tersinkron ke proses bot, serta integrasi **APIZ2Z** dari katalog endpoint yang terverifikasi.

Struktur file mengikuti base bot (referensi kedua); fitur & perilaku mengikuti Yann AI V15 Fixed. Detail audit: [docs/AUDIT.md](docs/AUDIT.md).

| Dokumen | Isi |
|---|---|
| [docs/AUDIT.md](docs/AUDIT.md) | Audit referensi, risiko, pemetaan file lama → baru, alasan stack |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Komponen, alur auth/ban/maintenance, namespace `yannajah`, cara menulis plugin |
| [docs/DATABASE.md](docs/DATABASE.md) | ERD, tabel, constraint, kebijakan hapus, backup/restore |
| [docs/RANKS.md](docs/RANKS.md) | Rank, matriks permission, ownership, aturan kuota |
| [docs/APIZ2Z.md](docs/APIZ2Z.md) · [APIZ2Z-MAPPING.md](docs/APIZ2Z-MAPPING.md) | Verifikasi API, adapter, endpoint → command |
| [docs/FEATURES.md](docs/FEATURES.md) | Katalog fitur + status (dibuat otomatis) |
| [docs/DEPLOY-NAT-VPS.md](docs/DEPLOY-NAT-VPS.md) | Langkah deploy di VPS NAT yang sama dengan CDN APIZ2Z (Nauval Cloud, Managed Domain, Neon) |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Kebutuhan & rekomendasi VPS, setup production, hardening, monitoring, update/rollback, troubleshooting |
| [docs/REPORT.md](docs/REPORT.md) | Laporan akhir: selesai / sebagian / belum / terblokir |

## Persyaratan

- Node.js ≥ 20 (diuji 22.22), npm
- PostgreSQL ≥ 13 (diuji 16) — untuk backend/dashboard
- ffmpeg (dengan libwebp, libopus, libmp3lame) — untuk stiker & efek audio
- Ponsel dengan WhatsApp untuk pairing

## Instalasi

```bash
cd YannAjahNew
npm ci
cp .env.example .env && chmod 600 .env    # isi nilai sesuai komentar di file
```

### 1. Backend + dashboard

```bash
npm run migrate                                                   # buat tabel (aman diulang)
node server/cli.js bootstrap-developer --username kamu --email kamu@gmail.com   # DEVELOPER pertama
npm run dashboard                                                 # http://127.0.0.1:8787
```
Login dengan Google memakai email tadi (akun ditautkan otomatis karena email terverifikasi Google). Sebelum Google OAuth disetel: `node server/cli.js login-link --username kamu` mencetak link login sekali pakai (15 menit).

### 2. Daftarkan nomor bot & password

Dashboard → **Bot** → *+ Tambah bot*: nama bot, nomor WhatsApp bot, password bot (≥ 10 karakter, huruf & angka). Atau dari server: `node server/cli.js set-bot-password --phone 6281234567890` (input tersembunyi). Password hanya disimpan sebagai hash bcrypt; reset kapan saja dari dashboard (sesi bot lama otomatis dicabut).

### 3. Jalankan bot

```bash
npm start                 # tanya metode pairing (default)
npm run start:qr          # QR code
npm run start:pairing     # pairing code untuk nomor bot terdaftar
```
Urutan: banner **YANNZAJAH** → validasi konfigurasi → login ke server lisensi (nomor bot + password bot; pesan gagal sengaja sama untuk nomor tak terdaftar / password salah) → status akun & bot dicek → database lokal & plugin → pairing WhatsApp (jika belum ada session) → heartbeat. Restart berikutnya memakai token tersimpan tanpa password. Nomor yang dipairing **wajib sama** dengan nomor bot di dashboard.

Pairing code memakai `sock.requestPairingCode(nomor, kode8)` dan QR memakai event `connection.update` — keduanya diverifikasi ada di `@whiskeysockets/baileys@7.0.0-rc14` yang terpasang. Tautkan di WhatsApp: *Perangkat tertaut → Tautkan perangkat* (QR) atau *Tautkan dengan nomor telepon* (kode). QR/kode hanya tampil di terminal, tidak ditulis ke log.

## `settingsbot.js` & environment

`settingsbot.js` berisi konfigurasi non-rahasia (dikelompokkan: bot, owner, prefix, chat, logger, pairing, license, database, api, plugin, media, limit, permission, cache, concurrency, retry, timeout, dashboard, harga/sewa, links, image, mess) dengan nilai yang diambil dari settings Yann AI V15. Semua secret (API key, password DB, OAuth secret, session secret, backup key) **hanya** dari environment — lihat [.env.example](.env.example). Konfigurasi divalidasi saat start; error tidak mencetak nilai secret.

## Namespace `yannajah`

```js
await yannajah.sendmessage(jid, 'halo')
await yannajah.reply(m, 'balasan')
await yannajah.react(m, '✅')
await yannajah.sendFile(jid, 'https://…/foto.jpg', { caption: 'ini' })
yannajah.database.get(['users', jid, 'money'])
yannajah.database.set('settings.public', true)
await yannajah.api.get('/api/search/google', { q: 'node.js' })
yannajah.auth.isActive()
yannajah.plugins.register({ id, name, category, description, ... })
```
Detail & cara menulis plugin: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Fitur

`npm run features:report` menghitung dari registry + hasil test terakhir dan menulis [docs/FEATURES.md](docs/FEATURES.md). Hasil terakhir:

| | Jumlah |
|---|---:|
| Fitur unik yang berfungsi | **865** (381 lokal + 484 APIZ2Z) |
| Lulus uji otomatis | 722 (187 unit, 484 mock APIZ2Z, 51 ffmpeg/Jimp nyata) |
| Implemented tanpa uji otomatis (butuh socket WhatsApp, dsb.) | 143 |
| Butuh `APIZ2Z_API_KEY` | 484 |
| Backlog V15 (`planned`, sebagian alias) | 966 |
| Dikecualikan kebijakan (`disabled`) | 102 |

Target 1.500–2.000+ diperlakukan sebagai roadmap: backlog V15 sudah tercatat per nama command dan bisa dikerjakan bertahap; tidak ada command kosong yang diklaim berfungsi.

## Integrasi APIZ2Z

Isi `APIZ2Z_API_KEY` (dari akun di apiz2z.web.id). Key dikirim lewat header `Authorization: Bearer`. Endpoint diverifikasi dari source platform di repo ini; perbarui dengan `npm run catalog:sync`. Detail: [docs/APIZ2Z.md](docs/APIZ2Z.md).

## Test

```bash
npm run check                                   # syntax check semua JavaScript
TEST_DATABASE_URL=postgres://user:pass@127.0.0.1:5432/db_test npm test
```
`TEST_DATABASE_URL` harus database sekali pakai (setiap file test membuat & menghapus schema sendiri; ditolak jika sama dengan `DATABASE_URL`). Tanpa variabel itu, test backend dilewati. Hasil terakhir: **795 lulus, 0 gagal, 0 dilewati**.

## Build distribusi & obfuscation

```bash
npm run build:dist      # dist/YannAjahNew (bot saja, tanpa server/ dan test)
```
46 file inti bot diobfuscate (`javascript-obfuscator`) sebagai lapisan tambahan — **bukan** pengganti autentikasi atau secret management; kode tetap bisa direkayasa balik. `settingsbot.js`, katalog, dataset, dan migrasi tidak diobfuscate. Build diuji otomatis (dimuat & dijalankan dari folder dist).

## Backup, restore, pencabutan akses, troubleshooting

Lihat [docs/DATABASE.md](docs/DATABASE.md#backup--restore) dan [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Ringkas: `node server/cli.js backup --out f.json.enc` / `restore --in f.json.enc --confirm-empty`; cabut akses bot dari dashboard (Ban / Disable / Cabut sesi / ganti password) — berlaku paling lambat satu interval heartbeat.

## Struktur direktori

```
YannAjahNew/
├── index.js            entry bot (banner, lisensi, pairing, event)
├── settingsbot.js      konfigurasi bot (non-rahasia)
├── settings.js         shim global untuk plugin lama
├── yannajah.js         namespace yannajah + facade database bot
├── command.js          router command
├── menu.js             menu dari registry
├── myfunct/            message.js (serializer), handler.js (welcome/left)
├── source/database.js  database JSON lokal (atomik)
├── library/            config, logger, net (anti-SSRF), apiz2z, license, connection, registry, media, …
│   └── catalog/        apiz2z-endpoints.json, v15-backlog.json
├── plugins/            fitur per kategori (+ apiz2z/, backlog/)
├── data/               dataset V15 (game, islami, gambar)
├── server/             backend pusat + dashboard (migrations, lib, services, routes, public, cli.js)
├── tests/              server/ (Postgres) & bot/
├── tools/              sync katalog, laporan fitur, syntax check, build dist
└── docs/
```
