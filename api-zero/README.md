# API Zero

REST API gateway dengan UI kartun. Semua fitur dipanggil lewat satu format:

```
https://api-zero.web.id/api/(path)/(fitur)?param=...
```

Contoh: `/api/download/tiktok-v3?url=...`, `/api/ai/gpt?text=halo`, `/api/maker/attp?text=halo`

- **456 endpoint** dalam 21 kategori (AI, Downloader, Maker, Canvas, Tools, Search, …)
- **Provider asli disembunyikan**: alamat, nama, dan key provider hanya ada di server. Field
  branding (`creator`, `author`, `channel`, …) dibuang, dan link file dari provider diganti jadi
  `/api/media/<token>` di domain sendiri (token terenkripsi AES-256-GCM).
- **Respons**: JSON, gambar, video, audio, file — media di-stream langsung (support Range / seek).
- **UI**: cari fitur, filter kategori, form parameter, tombol "Coba sekarang", preview respons
  (JSON berwarna, gambar, video, audio, URL media di dalam JSON), tombol salin di mana-mana.
- **Contoh kode**: cURL, JavaScript (fetch), Node.js (axios), Python, PHP, Go, Ruby, Java, Dart.

## Endpoint bawaan

| Path | Isi |
|------|-----|
| `GET /api/list` | Daftar semua endpoint (tanpa info provider) |
| `GET /api/status` | Status server |
| `GET /api/media/:token` | File media dari provider, lewat domain sendiri |
| `GET\|POST /api/(path)/(fitur)` | Fitur. Endpoint upload juga menerima `POST` body file mentah |

Upload file (endpoint yang punya badge `GET/POST`):

```bash
curl -X POST "https://api-zero.web.id/api/ai/gpt?text=apa+ini" \
  -H "Content-Type: image/jpeg" --data-binary @foto.jpg
```

## Jalankan lokal

```bash
cd api-zero
npm install
cp .env.example .env   # isi key provider
npm start              # http://localhost:3000
npm test
```

## Deploy ke Vercel

1. Vercel → **Add New → Project** → pilih repo ini.
2. **Root Directory: `api-zero`** (penting, supaya situs lama di root nggak ikut).
3. **Settings → Environment Variables** (Production + Preview):
   - `THERESAV_API_KEY`, `BOTCAHX_API_KEY`, `DONGTUBE_API_KEY`
   - `PUBLIC_BASE_URL=https://api-zero.web.id`
   - `APP_SECRET` = string acak panjang (untuk enkripsi link media)
4. Deploy, lalu **Settings → Domains** → tambah `api-zero.web.id` dan arahkan DNS sesuai petunjuk Vercel.

Key **tidak pernah** ditulis di kode; kalau key provider kosong, endpoint provider itu menjawab
`503 NOT_CONFIGURED`.

## Struktur

```
api-zero/
├── index.js              # server Express + route /api/*
├── lib/providers.js      # alamat & cara kirim key tiap provider (server-only)
├── lib/catalog.js        # katalog publik (tanpa info provider)
├── lib/proxy.js          # teruskan request + bersihkan respons
├── lib/hide.js           # buang branding, enkripsi link media provider
├── lib/fetchFile.js      # ambil file dari URL (anti-SSRF) untuk endpoint upload
├── data/endpoints.json   # spec endpoint (server-only)
└── public/               # UI kartun (index.html, style.css, app.js)
```

## Tambah endpoint

Tambah satu objek di `data/endpoints.json`:

```json
{
  "server": "faa",
  "category": "Downloader",
  "name": "TikTok Downloader v4",
  "desc": "Download video TikTok tanpa watermark.",
  "path": "/api/download/tiktok-v4",
  "upstream": "/faa/tiktok",
  "params": [{ "name": "url", "required": true, "placeholder": "https://vt.tiktok.com/..." }],
  "sample": { "url": "https://vt.tiktok.com/xxxx" }
}
```

`server` salah satu dari `theresav`, `botcahx`, `dongtube`, `nexray`, `faa` (lihat `lib/providers.js`).
Opsional: `rename` (`{"url":"link"}` kalau nama parameter di provider beda), `fixed` (parameter tetap).
