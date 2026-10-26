'use strict';
// Alamat website lisensi (web database bot: nomor, password, status).
// Development: tidak dikunci, alamat diambil dari LICENSE_SERVER_URL (.env).
// Distribusi: `npm run build:dist -- --license-url https://...` menulis alamatnya di WEB_DATABASE
// pada yannajah.js (lalu diobfuscate penuh). yannajah.js memanggil lock() sebelum konfigurasi
// dimuat, sehingga .env/settingsbot.js tidak bisa mengarahkan bot ke server lain.
// Yang ditanam hanya alamat website, bukan kredensial database.
const endpoint = { url: null, locked: false };

endpoint.lock = url => {
  if (!url || endpoint.locked) return endpoint;
  endpoint.url = new URL(url).origin;
  endpoint.locked = true;
  Object.freeze(endpoint);
  return endpoint;
};

module.exports = endpoint;
