# YannAjah AI — jalankan di panel Pterodactyl

Bot ini butuh **web database** (YannAjah-WebDatabase) yang sudah online. Alamatnya sudah tertanam di
`yannajah.js`, jadi tidak perlu diisi. Kalau web database mati, bot **berhenti** dan console menampilkan
error merah; bot tersambung lagi sendiri (cek tiap 30 detik) setelah web database hidup.

## 1. Buat server di panel

- Egg: **Node.js** (generic / `parkervcp/yolks nodejs_22`) — Node.js **20 atau lebih baru**.
- RAM minimal **512 MB** (disarankan 1 GB), disk **1 GB**.
- Startup / **Main file**: `yannajah.js`
  (kalau egg memakai perintah manual: `node yannajah.js`).
- Variabel egg `NODE_PACKAGES` / `USER_UPLOAD` dibiarkan default; **Auto update (git) dimatikan**.

## 2. Upload file

1. Buka **Files** → upload `YannAjah-AI.zip` → klik kanan → **Unarchive**.
2. Pindahkan isi folder `YannAjah-AI/` ke root (`/home/container`) kalau terekstrak di dalam folder.
3. Buka `settingsbot.js`: ganti `global.owner`, `global.botname`, `global.custompairing`, dll. (lihat CARA-EDIT.txt).
4. API key APIZ2Z sudah ada di `settingsbot.js` (`global.apikeyapiz2z`). File `.env` opsional.

## 3. Start pertama

Klik **Start**. Panel menjalankan `npm install` (sekali, ±2–5 menit) lalu bot jalan:

```
🔐 Login ke server lisensi YannAjahNew
Nomor bot terdaftar (contoh 6281234567890):   ← ketik di kolom perintah console, Enter
Password bot:                                  ← password bot dari Developer, Enter
✔ Terverifikasi: NamaBot (628xxxx)

Belum ada session WhatsApp. Pilih metode tautkan perangkat:
  1) QR code
  2) Pairing code (nomor telepon)
Pilih 1/2:
```

- **1** → QR muncul di console → WhatsApp → Perangkat tertaut → Tautkan perangkat → scan.
- **2** → muncul kode (default `YANNAJAH`, diatur di `settingsbot.js` → `pairing.customCode`
  atau `.env` `PAIRING_CUSTOM_CODE`) → WhatsApp → Tautkan dengan nomor telepon → masukkan kode.

Setelah itu token & session tersimpan: restart berikutnya **tidak** minta password / pairing lagi.

## 4. Pesan di console

| Pesan | Arti |
|---|---|
| `✖ Web database (server lisensi) tidak bisa dihubungi` | Web database mati / VPS down. Bot berhenti; nyala lagi otomatis saat pulih |
| `⏸ Web database sedang maintenance` | Developer menyalakan maintenance web. Bot diam total sampai dimatikan |
| `✖ Bot ini sedang diban / dinonaktifkan` | Diatur dari web database. Server berhenti (exit 78) |
| `✖ Nomor WhatsApp yang ditautkan BUKAN nomor bot terdaftar` | Pairing pakai nomor lain. Hapus folder `session/`, start ulang |

## 5. Ganti nomor / pairing ulang

Stop → hapus folder `session/` (dan `library/database/license-session.json` kalau mau login ulang) → Start.
