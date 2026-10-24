'use strict';
// Alamat website lisensi (database bot: nomor, password, status).
// Development: tidak dikunci, alamat diambil dari LICENSE_SERVER_URL (.env).
// Distribusi: `npm run build:dist -- --license-url https://...` menulis ulang file ini di dist
// dengan alamat tetap (locked: true) lalu meng-obfuscate-nya bersama index.js dan library/,
// sehingga pembeli cukup memasukkan nomor + password bot dan .env/settingsbot.js tidak bisa
// mengarahkan bot ke server lain. Yang ditanam hanya alamat website, bukan kredensial database.
module.exports = { url: null, locked: false };
