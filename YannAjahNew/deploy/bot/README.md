# YannAjah AI

Bot WhatsApp YannAjah (struktur seperti Yann AI V15 / Lena AI). Nomor, password bot, ban, dan maintenance
diatur dari **YannAjah Web Database**; bot ini hanya login ke web itu (alamat tertanam di `yannajah.js`).

```
handler.js        event WhatsApp: pesan masuk & welcome/left grup
yannajah.js       entry bot (login web database, pairing QR / kode, koneksi WhatsApp)
yannai-cmd.js     router command (lisensi, maintenance, izin, limit, cooldown, …)
package.json
README.md
settingsbot.js    konfigurasi bot (nama, owner, prefix, pairing, menu, harga, link, pesan)
source/           message.js (serializer), yannai-menu.js (isi menu), database.js
lib/  library/    logika fitur & inti bot
plugins/<kategori>/<command>.js   1 file = 1 command
data/  assets/    dataset & gambar
```

Cara menjalankan di panel Pterodactyl: lihat **PANDUAN-PANEL.md**. Di VPS/terminal biasa: `npm install` lalu `npm start`.
