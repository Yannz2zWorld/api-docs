# API Zero

REST API platform dengan UI kartun (tanpa 3D). Semua fitur dipanggil lewat satu format:

```
https://api-zero.web.id/api/(path)/(fitur)?apikey=KEY_KAMU&param=...
```

## Halaman

| Halaman | Isi |
|---|---|
| `/login` | Masuk (username/email + sandi), Daftar (username, sandi, no HP, email), Login Google, Lupa sandi (kode via SMTP). Bubble maintenance mengambang saat maintenance. |
| `/home` | Sapaan, plan, kuota hari ini, saldo, API key + contoh request. |
| `/playground` | Taman endpoint: cari, filter kategori/plan, coba langsung, preview JSON/gambar/video/audio, contoh kode (cURL, JS, Node.js, Python, PHP, Go, Ruby, Java, Dart) + tombol salin. Endpoint premium bergembok. |
| `/profile` | ID, foto profil, saldo, tier, ganti username & sandi, kelola API key (custom key mulai Premium), riwayat pesanan. |
| `/price` | Beli plan pakai saldo (langsung aktif) atau transfer manual (DANA/GoPay/… diatur developer), top up saldo. |
| `/chat` | Live chat semua user + developer; tiap pesan menampilkan foto, username, tier, dan ID. |
| `/developer` | Developer panel (khusus developer). |

## Plan

| Plan | Harga / 30 hari | Request/hari | API key | Custom key | Endpoint |
|---|---|---|---|---|---|
| Free | gratis | 100 | 1 | – | plan Free |
| Basic | Rp5.000 | 1.000 | 3 | – | plan Basic |
| Premium | Rp10.000 | 5.000 | 5 | ✔ | + plan Premium |
| Super | Rp15.000 | 10.000 | 10 | ✔ | + plan Super |
| Nebula | Rp20.000 | 20.000 | 25 | ✔ | + plan Nebula |
| Freedom | Rp25.000 | 50.000 | ∞ | ✔ | semua |
| Developer | tersembunyi | ∞ | ∞ | ✔ | semua + panel (tier hanya terlihat di live chat) |

Plan diatur di `lib/tiers.js`. Tiap endpoint punya plan minimal; user bisa memakai endpoint kalau plannya
setara atau lebih tinggi. Plan bawaan endpoint ada di `lib/catalog.js` (provider tidak menandai endpoint
premium secara terbuka, jadi ini pilihan awal) dan bisa diubah per endpoint di Developer panel.

## Developer panel

- **Ringkasan**: statistik + **maintenance** (on/off + teks bubble). Saat on, API menjawab 503 untuk semua user kecuali developer.
- **User**: cari, tambah user, atur plan + durasi, tambah/kurangi saldo, ganti username, reset sandi, ban (opsional blacklist email/HP/username), hapus.
- **Endpoint**: cari & filter, atur plan, kunci, sembunyikan, hapus/pulihkan, tambah endpoint sendiri (form, tanpa AI) ke provider yang ada atau URL bebas, edit endpoint buatan sendiri.
- **Pesanan**: terima/tolak transfer manual (plan langsung aktif / saldo masuk).
- **Pembayaran**: metode pembayaran (mis. DANA · a.n. W\*\* N\*\*\* H\*\*\* · 0812…).
- **Blacklist**: email / no HP / username yang tidak boleh daftar/login.

Akun developer = username/email di env `DEVELOPER_USERNAMES` / `DEVELOPER_EMAILS` (otomatis jadi tier Developer saat login).

## Provider disembunyikan

Alamat, nama, dan key provider hanya ada di server (`lib/providers.js` + env). Field branding (`creator`,
`author`, `channel`, …) dibuang, nama provider di teks diganti, dan link file dari provider diganti jadi
`/api/media/<token>` di domain sendiri (token terenkripsi AES-256-GCM, support Range/seek).

## Respons API

- Sukses JSON: `{ "status": true, "creator": "API Zero", ... }`
- Media (gambar/video/audio/file) dikirim langsung dengan `Content-Type` aslinya.
- Error: `{ "status": false, "error": "KODE", "message": "..." }`, mis. `APIKEY_REQUIRED`, `INVALID_APIKEY`,
  `PLAN_REQUIRED` (+ `requiredPlan`), `ENDPOINT_LOCKED`, `QUOTA_EXCEEDED`, `MAINTENANCE`, `RATE_LIMITED`.
- Header `X-Quota-Limit` / `X-Quota-Remaining`. Request yang gagal tidak memotong kuota.
- Endpoint upload juga menerima `POST` body file mentah: `curl -X POST "…/api/ai/gpt?text=apa+ini&apikey=KEY" -H "Content-Type: image/jpeg" --data-binary @foto.jpg`

## Deploy ke Vercel

1. Buat database PostgreSQL gratis (mis. [Neon](https://neon.tech)), salin connection string-nya.
2. Vercel → **Add New → Project** → pilih repo ini → **Root Directory: `api-zero`**.
3. **Settings → Environment Variables** (lihat `.env.example`): wajib `DATABASE_URL`, `AUTH_SECRET`,
   `DEVELOPER_USERNAMES`, key provider. Opsional `GOOGLE_CLIENT_ID`, SMTP (lupa sandi), `PUBLIC_BASE_URL`.
4. Deploy. Tabel database dibuat otomatis saat request pertama.
5. **Settings → Domains** → tambah `api-zero.web.id`.
6. Daftar di `/login` dengan username developer → buka `/developer`, isi metode pembayaran.

## Lokal

```bash
cd api-zero
npm install
cp .env.example .env     # isi DATABASE_URL, AUTH_SECRET, DEVELOPER_USERNAMES, key provider
npm start                # http://localhost:3000
TEST_DATABASE_URL=postgres://...db_kosong npm test
```

## Struktur

```
api-zero/
├── index.js            # server + halaman
├── routes/             # auth, me (profil/key), billing, chat, dev (panel), gateway (/api/*)
├── lib/                # db, schema.sql, auth (sesi), tiers, keys (kuota), endpoints, proxy, hide, settings, mailer
├── data/endpoints.json # spec endpoint bawaan (server-only)
├── views/              # halaman HTML
└── public/             # CSS + JS halaman
```
