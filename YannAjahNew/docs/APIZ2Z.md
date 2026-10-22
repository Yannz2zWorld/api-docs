# Integrasi APIZ2Z (https://apiz2z.web.id)

## Cara verifikasi (jujur)

- Situs `https://apiz2z.web.id` **tidak bisa diakses dari container pengembangan** (proxy menjawab HTTP 403 untuk host itu). Dokumentasi live tidak dibaca.
- Repositori tempat proyek ini berada **adalah source platform APIZ2Z** (`README`, `PANDUAN-LENGKAP.md`, `cdn-server.js` merujuk `apiz2z.web.id`). Endpoint diverifikasi langsung dari kode route di `plugin/*.js` oleh `tools/sync-apiz2z-catalog.js`, yang memuat setiap plugin dan mengambil `path`, `name`, `desc`, `category`, `params` (wajib/opsional/pilihan/alias/upload). Route yang hanya mendokumentasikan parameter di query string path (mis. `/api/download/tiktok?url=`) juga terbaca.
- Hasil: `library/catalog/apiz2z-endpoints.json` — **487 endpoint publik**, 3 dikecualikan kebijakan (lihat bawah). Endpoint cadangan internal (`backupOnly`, mis. `/api/alt/*`) tidak dimasukkan.
- Belum ada uji **live** ke server (butuh akses jaringan + API key). Semua command diuji dengan **transport tiruan**.

## Kontrak API (dari kode gateway `index.js` platform)

| Aspek | Nilai |
|---|---|
| Base URL | `https://apiz2z.web.id` (`APIZ2Z_BASE_URL`) |
| Metode | `GET` + query string. Endpoint ber-`upload` juga menerima `POST` body file mentah (maks 8 MB) dengan `Content-Type` file, parameter lain tetap di query |
| Autentikasi | `Authorization: Bearer <API_KEY>` atau header `x-api-key`. **YannAjahNew memakai header Bearer; key tidak pernah ditaruh di URL** |
| Sukses JSON | `{ status: true, ...hasil }` (field `creator` milik upstream dibuang gateway) |
| Sukses media | body biner `image/*`, `video/*`, `audio/*` (maks ±4 MB di Vercel) |
| Link media | link di hasil diganti gateway menjadi `https://apiz2z.web.id/media/<token>` |
| Error | `{ success:false | status:false, error: KODE, message }` — `AUTH_REQUIRED`, `INVALID_API_KEY`, `API_KEY_DISABLED/REVOKED/EXPIRED`, `ACCOUNT_RESTRICTED`, `TIER_RESTRICTED`, `QUOTA_EXCEEDED` (429 + `Retry-After`), `ENDPOINT_UNAVAILABLE`, `ENDPOINT_LOCKED`, `MAINTENANCE`, `UPSTREAM_TIMEOUT` (504), `UPSTREAM_FAILED` (502), `INVALID_PARAMETER` (400) |
| Rate limit | kuota harian per key/tier (`X-RateLimit-Limit/Remaining/Reset`) |
| Health | `GET /health` → `{status:"ok"}` (tanpa key, tidak memakai kuota) |

## Adapter (`library/apiz2z.js` → `yannajah.api`)

- Hanya memanggil path yang ada di katalog; endpoint lain → `UNKNOWN_ENDPOINT` tanpa request.
- Anti-SSRF: tujuan request hanya host di allowlist (`APIZ2Z_ALLOWED_HOSTS` + host base URL). Unduhan link media dari hasil memakai `library/net.js#download` yang menolak IP privat/loopback/link-local (dicek pada IP hasil DNS) dan protokol selain http/https.
- Validasi parameter dari katalog: wajib, pilihan (`options`), panjang maks, karakter kontrol, parameter tak dikenal ditolak.
- Timeout (`APIZ2Z_TIMEOUT_MS`), retry terbatas (`APIZ2Z_RETRIES`, hanya untuk error jaringan/timeout/5xx/429 — **tidak** untuk `QUOTA_EXCEEDED`, `MAINTENANCE`, `ENDPOINT_UNAVAILABLE`), rate limit per menit, concurrency, batas ukuran respons, cache GET JSON 5 menit.
- Parsing sesuai `Content-Type` + magic bytes: JSON, media biner, atau teks. JSON rusak → `INVALID_RESPONSE`.
- Log aman: hanya path (tanpa query/key) dan kode error.
- `getStatus()` memakai `/health`.

## Command WhatsApp (`plugins/apiz2z/apiz2z.js`)

Satu command per endpoint (484). Nama mengikuti nama V15/base untuk endpoint populer (`.tiktok/.tt`, `.ig`, `.ytmp3`, `.play`, `.ai/.gpt`, `.gemini`, `.removebg`, `.hd`, `.brat`, `.qc`, `.ssweb`, `.tr`, `.cuaca`, `.jadwalsholat`, …); lainnya otomatis dari path. Bila bentrok dengan fitur lokal, fitur lokal menang dan command APIZ2Z memakai nama berkategori (mis. `.toolsping`, `.gamesasahotak`). Daftar lengkap: **[APIZ2Z-MAPPING.md](APIZ2Z-MAPPING.md)**.

Input:
```
.tiktok https://vt.tiktok.com/xxxx            # 1 parameter wajib = seluruh teks
.ytmp3 https://youtu.be/xxx bitrate=320k      # parameter opsional pakai key=value
.cocokpasangan Budi|Ani                        # >1 parameter wajib dipisah |
(kirim/reply gambar) .removebg                 # endpoint upload: media di-POST sebagai body
.welcomecard                                   # avatar/username/guildName/memberCount diisi otomatis
```
Semua command APIZ2Z: `limit: 1`, cooldown 5 detik, status `needs_api_key` bila `APIZ2Z_API_KEY` kosong.

## Endpoint yang dikecualikan

| Endpoint | Alasan |
|---|---|
| `/api/ai/deepnude-ai` | Konten seksual dari foto orang nyata tanpa persetujuan |
| `/api/premium/alightmotion-send-prem`, `/api/premium/alightmotion-verify` | Aktivasi premium aplikasi pihak ketiga, di luar cakupan bot |

## Memperbarui katalog

Setelah platform APIZ2Z menambah/mengubah endpoint: `npm run catalog:sync` (di dalam repo `api-docs`, butuh `npm ci` di root repo) → `npm test` → `npm run features:report`.
