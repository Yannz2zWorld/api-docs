'use strict';
// Daftar server API pihak ketiga yang di-proxy platform ini (selain theresav).
// Setiap server: key-nya HANYA dari environment variable (keyEnv) — tidak pernah ditulis di repo,
// tidak pernah dikembalikan ke user atau masuk log. Set nilainya di Vercel → Project → Settings →
// Environment Variables.
//
//   keyMode : 'query'  -> key dikirim sebagai query param (?<keyName>=KEY)   [paling umum]
//             'none'   -> server publik, nggak pakai key
//             'header'  -> key dikirim sebagai header (<keyName>: KEY)
//   keyName : nama param/header untuk key (default 'apikey')
//   strip   : field branding server itu yang dibuang dari hasil (mis. 'author', 'channel')
//   perMinute : batas request per menit dari key-nya. Cek otomatis cuma boleh makai separuhnya,
//               sisanya buat pengguna (lib/apiproxy.js).
//
// Kalau ternyata sebuah server memakai cara berbeda (mis. header 'x-api-key'), cukup ubah keyMode
// / keyName di sini — tidak perlu sentuh kode endpoint-nya.
module.exports = {
  clutch:   { base: 'https://api.clutch.web.id', keyEnv: 'CLUTCH_API_KEY',   keyMode: 'query', keyName: 'apikey' },
  dongtube: { base: 'https://api.dongtube.id',   keyEnv: 'DONGTUBE_API_KEY', keyMode: 'query', keyName: 'apikey', strip: ['author', 'channel'], perMinute: 60 },
  pitucode: { base: 'https://api.pitucode.com',  keyEnv: 'PITUCODE_API_KEY', keyMode: 'query', keyName: 'apikey' },
  termai:   { base: 'https://api.termai.cc',      keyEnv: 'TERMAI_API_KEY',   keyMode: 'query', keyName: 'key' },
  // Public, no key needed. Endpoints from here are mostly backups (config/endpointGroups.js).
  faa:      { base: 'https://api-faa.my.id',      keyEnv: null,               keyMode: 'none' }
};
