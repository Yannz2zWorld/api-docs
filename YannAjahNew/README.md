# YannAjahNew

Bot WhatsApp modular dengan namespace `yannajah`, autentikasi bot ke **backend pusat** (nomor bot + password bot), **website dashboard** dengan login email + password (Google opsional), **5 rank website** (RESELLER, SUKI, RAJA, DEWA, DEVELOPER) dengan kuota nomor 10/50/100/1000/∞, ban/unban & maintenance yang tersinkron ke proses bot, serta integrasi **APIZ2Z** dari katalog endpoint yang terverifikasi. MEMBER bukan akun website — ia hanya pemakai bot yang nomornya didaftarkan reseller ke atas.

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
node server/cli.js set-password --username kamu                   # password login website (tersembunyi)
npm run dashboard                                                 # http://127.0.0.1:8787
```
Masuk website dengan **email + password** tadi. Google login opsional (kalau `GOOGLE_CLIENT_ID` diisi); link sekali pakai `node server/cli.js login-link --username kamu` tetap ada untuk darurat.

### Alur jual script ke pembeli

1. Pembeli membeli script bot ke Anda.
2. Anda masuk website (DEVELOPER) → **Akun** → *+ Tambah akun*: username, email, **password website**, dan rank sesuai paket (RESELLER / SUKI / RAJA / DEWA).
3. Berikan email + password itu ke pembeli. Pembeli masuk website yang sama dan hanya melihat menu & kuota sesuai rank-nya.
4. Pembeli bisa **ganti password sendiri** (tombol *Ganti password*). Atasan bisa **reset password** akun di bawahnya (tombol *Password*).
5. **MEMBER bukan akun website** — pembeli yang hanya ingin memakai bot cukup memberikan nomornya ke reseller (atau rank di atasnya); reseller yang mendaftarkan nomor itu. MEMBER tidak pernah login ke website.

Keamanan login: password disimpan sebagai hash bcrypt; pesan gagal selalu sama ("Email atau password salah") sehingga email terdaftar tidak bisa ditebak; 5x salah dalam 15 menit = akun dikunci 15 menit; percobaan dibatasi juga per IP; login dari website lain ditolak.

### 2. Daftarkan nomor bot & password

Dashboard → **Bot**: reseller ke atas hanya *+ Tambah bot* (nama, nomor WhatsApp) dan *Hapus* nomor, sesuai kuota akun. Saat nomor ditambahkan, **password bot dibuat otomatis** dan ditampilkan sekali — reseller menyerahkannya ke pembeli bersama script. Operasi bot lain (ganti password bot, nyalakan/matikan, ganti nama, cabut sesi, ban, maintenance per bot) **hanya DEVELOPER**. Nomor, password, status, ban, dan maintenance bot disimpan di PostgreSQL pusat; bot tidak pernah menyimpan URL/password database (lihat [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).

Tanpa dashboard, lewat server (DEVELOPER/owner):
```bash
node server/cli.js add-bot      --username kamu --name "Bot 1" --phone 6281234567890   # password diketik tersembunyi
node server/cli.js list-bots    --username kamu
node server/cli.js set-bot-password --phone 6281234567890                               # ganti password (sesi lama dicabut)
node server/cli.js del-bot      --username kamu --phone 6281234567890 --confirm 6281234567890
```
Password hanya disimpan sebagai hash bcrypt; reset kapan saja (sesi bot lama otomatis dicabut).

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
| Fitur unik yang berfungsi | **1103** (619 lokal + 484 APIZ2Z) |
| Lulus uji otomatis | 740 (203 unit, 484 mock APIZ2Z, 53 ffmpeg/Jimp nyata) |
| Implemented tanpa uji otomatis (butuh socket WhatsApp, dsb.) | 363 |
| Butuh `APIZ2Z_API_KEY` | 484 |
| Backlog V15 (`planned`, sebagian alias) | 529 |
| Dikecualikan kebijakan (`disabled`) | 217 |

Fitur lokal V15 sudah dibangun bertahap (toko/list, owner/reseller/premium/sewa, grup/sider/warn/absen/ultah/streak/jadwal, fun/primbon/ekonomi, menu & font, maker quote sticker, image mirror/crop). Sisa backlog `planned` kebanyakan butuh endpoint APIZ2Z yang cocok. Yang `disabled` sengaja tidak dibuat (lihat [docs/FEATURES.md](docs/FEATURES.md)): NSFW, OSINT nomor, broadcast massal, panel Pterodactyl, obfuscator kode pihak ketiga. Tidak ada command kosong yang diklaim berfungsi.

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
npm run build:dist -- --license-url https://lisensi.domainkamu.com   # dist/YannAjahNew (bot saja)
```
Cara kerjanya sama seperti bot referensi: password bot disimpan di database website, bot hasil build menyambung ke website itu, dan alamatnya tertanam di kode yang diobfuscate.

- `--license-url` menanam alamat website lisensi di `library/license-endpoint.js` (string dikodekan penuh). Bot hasil build **selalu** login ke website itu; `LICENSE_SERVER_URL` di `.env` dan `settingsbot.js` tidak bisa mengarahkannya ke server lain.
- Pembeli/pemakai cukup menjalankan bot lalu memasukkan **nomor bot + password bot** yang Anda buat di dashboard. Tambah/hapus nomor, ganti password, ban, dan maintenance diatur dari website.
- Yang ditanam hanya **alamat website**, bukan URL/password database. Database hanya bisa diakses server website, jadi file bot yang bocor tidak bisa membaca atau mengubah database.
- Tanpa `--license-url`, dist memakai `LICENSE_SERVER_URL` dari `.env` (untuk tes).

Kode inti bot diobfuscate (`javascript-obfuscator`) sebagai lapisan tambahan: membuat kode sulit dibaca, tapi tidak mustahil direkayasa balik. Keamanan sesungguhnya ada di server (password bcrypt, sesi bisa dicabut, ban dari dashboard). `settingsbot.js`, katalog, dataset, dan migrasi tidak diobfuscate. Build diuji otomatis (dimuat & dijalankan dari folder dist).

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
