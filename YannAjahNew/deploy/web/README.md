# YannAjah Web Database

Website dashboard (login username + password) + API lisensi untuk semua bot YannAjah AI, di atas PostgreSQL.

```
server/index.js        server web (pm2: yannajah-web)
server/cli.js          perintah admin (migrate, status, set-password, login-link, backup, …)
server/migrations/     skema database (dijalankan otomatis oleh install-vps.sh)
server/public/         halaman dashboard
install-vps.sh         pemasang otomatis Ubuntu (Node, PostgreSQL, pm2, nginx, HTTPS)
ecosystem.config.js    konfigurasi pm2
```

Cara pasang: lihat **PANDUAN-VPS.md**.
