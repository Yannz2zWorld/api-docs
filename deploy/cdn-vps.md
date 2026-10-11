# CDN di VPS (file besar dikirim utuh)

Web utama tetap di Vercel. VPS cuma menjalankan `cdn-server.js`: ngelayani link
`/cdn/<id>` dan ngirim file **utuh** (Vercel cuma bisa ~4,5 MB per jawaban). File tetap
disimpan di tempat yang sama: file kecil di Postgres (Neon), file besar di bucket B2.
Upload tetap lewat website.

Cocok juga buat **VPS NAT** (IP dipakai bareng, cuma dapat beberapa port): koneksi masuk
lewat **Cloudflare Tunnel**, jadi nggak butuh port 80/443 sama sekali.

```
Pengunjung → https://cdn.apiz2z.web.id (Cloudflare) → tunnel → VPS :3000 → B2 / Neon
```

## 1. Domain ke Cloudflare (sekali aja)

1. Daftar/login di https://dash.cloudflare.com → **Add a domain** → `apiz2z.web.id` → paket **Free**.
2. Cloudflare nyalin record DNS yang ada. Cek record untuk web utama (Vercel) tetap ada,
   dan set ke **DNS only** (awan abu-abu) supaya Vercel tetap ngurus SSL web utama.
3. Ganti **nameserver** domain di tempat kamu beli domain ke 2 nameserver dari Cloudflare.
   Tunggu sampai Cloudflare bilang domainnya **Active** (bisa beberapa menit sampai beberapa jam).

## 2. Siapin VPS (Ubuntu 22.04/24.04)

Login SSH ke VPS (pakai port SSH yang dikasih panel), terus jalanin:

```bash
apt update && apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

git clone https://github.com/Yannz2zWorld/api-docs.git /opt/yannz-cdn
# repo private? git minta username + password: isi username GitHub, dan sebagai password
# pakai Personal Access Token (GitHub → Settings → Developer settings → Fine-grained token,
# akses Contents: Read-only ke repo ini).
cd /opt/yannz-cdn
npm ci --omit=dev
```

## 3. Isi `.env` di VPS

```bash
cd /opt/yannz-cdn
nano .env
```

Isinya (nilai rahasia **jangan** dikirim ke chat):

```
PORT=3000
DATABASE_URL=postgresql://...   # dari Neon → Connection string (sama kayak di Vercel)
S3_ENDPOINT=https://s3.us-east-005.backblazeb2.com
S3_BUCKET=webcdn22
S3_ACCESS_KEY_ID=...            # keyID Backblaze
S3_SECRET_ACCESS_KEY=...        # applicationKey Backblaze
```

Simpan (Ctrl+O, Enter, Ctrl+X), terus:

```bash
chmod 600 .env
pm2 start cdn-server.js --name yannz-cdn
pm2 save && pm2 startup     # jalankan perintah yang muncul, biar nyala lagi habis reboot
curl http://127.0.0.1:3000/  # harus keluar {"status":true,"service":"cdn","database":true}
```

## 4. Cloudflare Tunnel (gratis, tanpa buka port)

1. Cloudflare dashboard → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel**
   → **Cloudflared** → nama `yannz-cdn`.
2. Pilih **Debian/Ubuntu 64-bit**, salin perintah instalnya (ada token di dalamnya, jangan
   dibagi), jalanin di VPS. Status tunnel jadi **Healthy**.
3. Tab **Public Hostname** → **Add a public hostname**:
   - Subdomain: `cdn`, Domain: `apiz2z.web.id`
   - Service: **HTTP** → `localhost:3000`
4. Cek: buka `https://cdn.apiz2z.web.id/` → harus keluar `{"status":true,...}`.

## 5. Arahkan link baru ke VPS

Di **Vercel → Environment Variables** tambah `CDN_PUBLIC_URL` = `https://cdn.apiz2z.web.id`,
terus redeploy. Link upload baru jadi `https://cdn.apiz2z.web.id/cdn/<id>`. Link lama
`https://apiz2z.web.id/cdn/<id>` tetap jalan (yang itu tetap lewat Vercel).

## Update kode

```bash
cd /opt/yannz-cdn && git pull && npm ci --omit=dev && pm2 restart yannz-cdn
```

## Catatan

- Kalau VPS mati, link `cdn.apiz2z.web.id` ikut mati, tapi file-nya aman (di B2/Neon) dan
  link lama di domain utama tetap jalan. Hapus `CDN_PUBLIC_URL` di Vercel buat balik.
- Cloudflare gratis nggak ditujukan buat nyajiin video dalam jumlah sangat besar; buat
  pemakaian wajar aman, tapi kalau traffic video-nya gede, pertimbangkan VPS dengan IP sendiri.
