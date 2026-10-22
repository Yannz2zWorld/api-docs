# Audit & pemetaan referensi

Audit dilakukan atas file yang benar-benar tersedia: dua arsip yang diunggah dan repositori `api-docs` (tempat proyek ini berada).

## 1. Sumber yang diaudit

| Sumber | Isi | Peran untuk YannAjahNew |
|---|---|---|
| `base_buat_bikin_bot_baru.zip` (base Alip/Clutch) | `index.js`, `settings.js`, `menu.js`, `command.js` (switch-case 83 command), `myfunct/message.js`, `source/database.js` (JSON/Mongo), `library/*`, `plugins/` (kosong) | **Struktur** folder & nama file (referensi kedua) |
| `yann_ai_v15_fixed.zip` (Yann AI V15) | `settings.js`, `YannzAjah-cmd.js` (≈41 rb baris, 1.395 case unik), `handler.js`, `source/message.js`, `lib/*`, `plugins/*` (≈130 plugin), `data/*` (dataset game/islami/gambar) | **Fitur & perilaku**, isi `settingsbot.js` |
| Repo `api-docs` (platform apiz2z.web.id) | Express + PostgreSQL (Neon), migrasi SQL, `services/`, `routes/`, Google OAuth (`google-auth-library`), 487 endpoint di `plugin/`, test `node:test` | Pola web/dashboard, autentikasi, dan **sumber kebenaran endpoint APIZ2Z** |

`settingsbot.js` dan `yannajah.js` **belum ada** di kedua referensi, sehingga keduanya dibuat baru (lihat bagian 4).

## 2. Temuan & risiko di referensi

| # | Temuan | Risiko | Penanganan di YannAjahNew |
|---|---|---|---|
| 1 | `settings.js` V15 berisi API key/kredensial pembayaran dalam teks biasa (beberapa layanan) | Kebocoran key, penyalahgunaan saldo | Tidak disalin. Semua secret lewat environment (`.env.example`) |
| 2 | `index.js` V15 terenkripsi (6,6 MB) dengan "license check" tersembunyi | Tidak bisa diaudit | Tidak dipakai; lisensi dibuat ulang secara terbuka (`library/license.js` + `server/`) |
| 3 | Base `index.js` otomatis follow saluran WhatsApp lewat `String.fromCharCode(...)` tersembunyi | Perilaku tersembunyi | Dibuat eksplisit & default mati (`pairing.followChannelOnConnect`) |
| 4 | Password pairing base dibandingkan dengan nilai di `settings.js` (plaintext) | Siapa pun yang punya file bisa lolos | Diganti login ke backend pusat: nomor + password bot (bcrypt), token bisa dicabut |
| 5 | `eval` / `exec` dari chat owner (`>`, `=>`, `$`) | Remote code execution bila nomor owner dibajak | Tidak diimplementasikan |
| 6 | Database base/V15 berisi nomor telepon pengguna nyata | Privasi | Tidak disalin; database lokal mulai kosong |
| 7 | Fitur V15 untuk konten seksual dari foto orang nyata, spam massal (jpm, pushkontak, nglspam), pemalsuan bukti (fakedana, struk, fitnah), ambil alih grup | Bahaya, melanggar ketentuan WhatsApp | Tidak diimplementasikan; tercatat `disabled` beserta alasannya (`docs/FEATURES.md`) |
| 8 | Baileys dari fork GitHub/npm alias (`alipclutch-baileys`, `ZrooPro/baileys`) | Supply chain tidak jelas | Memakai paket resmi `@whiskeysockets/baileys@7.0.0-rc14` |
| 9 | Satu file `command.js`/`YannzAjah-cmd.js` raksasa | Sulit dipelihara/diuji | Plugin modular + feature registry dengan validasi metadata & konflik nama |
| 10 | Endpoint APIZ2Z | Situs `apiz2z.web.id` diblokir network policy container (HTTP 403 proxy) | Endpoint diverifikasi dari **source platform** di repo ini (`plugin/*.js`) lewat `tools/sync-apiz2z-catalog.js` |

## 3. Pemetaan file lama → baru

| Lama (base / V15) | Baru (YannAjahNew) | Keterangan |
|---|---|---|
| `index.js` | `index.js` + `library/connection.js` + `library/license.js` + `library/banner.js` | Entry tetap `index.js`; koneksi & lisensi dipisah |
| `settings.js` | `settingsbot.js` (konfigurasi) + `settings.js` (shim global legacy) | `settings.js` dipertahankan agar plugin lama tetap jalan |
| `command.js` | `command.js` (router) + `plugins/**` | Switch-case diganti registry |
| `menu.js` | `menu.js` | Menu dibangun otomatis dari registry |
| `myfunct/message.js` | `myfunct/message.js` | Serializer, kini paham LID Baileys 7 |
| `handler.js` (V15) | `myfunct/handler.js` | Welcome/left |
| `source/database.js` | `source/database.js` + facade `yannajah.database` di `yannajah.js` | JSON atomik + cadangan `.bak` |
| `library/function.js`, `converter.js`, `exif.js` | `library/function.js`, `library/media.js` | ffmpeg via `spawn` tanpa shell |
| `plugins/` (format `handler.command`) | `plugins/` | Format lama tetap didukung lewat adapter (`Registry.adaptLegacy`) |
| `data/*` (V15) | `data/*` | Hanya dataset yang layak (tanpa set vulgar/foto orang nyata) |
| — | `server/` | Backend pusat + dashboard (baru) |

## 4. Keputusan tanggung jawab file wajib

- **`settingsbot.js`** — konfigurasi non-rahasia bot (identitas, prefix, mode chat, pairing, lisensi, database, API, plugin, media, limit, permission, cache, concurrency, retry, timeout, pesan V15) + nama environment variable untuk secret. Divalidasi saat start (`library/config-loader.js`); error tidak pernah mencetak nilai secret.
- **`yannajah.js`** — namespace `yannajah` dan **facade database bot** (`yannajah.database.get/set/user/group/save`), plus `sendmessage/reply/react/sendFile`, `api`, `auth`, `plugins`. Database **pusat** (akun, rank, bot, kredensial, audit) tidak diakses langsung oleh bot; bot hanya memakai API lisensi, jadi credential database pusat tidak pernah berada di mesin bot.

## 5. Stack yang dipilih & alasannya

| Bagian | Pilihan | Alasan |
|---|---|---|
| Runtime | Node.js ≥ 20 (diuji di 22.22) | Sama dengan referensi & platform APIZ2Z |
| WhatsApp | `@whiskeysockets/baileys` 7.0.0-rc14 (ESM, dimuat via `import()`) | Paket resmi; QR (`connection.update.qr`) dan `requestPairingCode(nomor, kode8)` terverifikasi di source paket |
| Database pusat | PostgreSQL (driver `pg`) | Platform APIZ2Z sudah memakai PostgreSQL (Neon). `pg` mendukung transaksi interaktif + `SELECT … FOR UPDATE` yang dibutuhkan agar kuota aman terhadap request bersamaan |
| Database bot | JSON lokal (atomik) | Sama dengan referensi; hanya data per-chat (limit, game, catatan) |
| Dashboard | Express + HTML/JS statis | Pola yang sama dengan web APIZ2Z; tanpa build step |
| Login dashboard | Google OIDC (`google-auth-library`) | Sama dengan web APIZ2Z |
| Password | bcrypt (`bcryptjs`, cost 12) | Sesuai master prompt; murni JS (tanpa build native) |
