'use strict';
// Daftar server API pihak ketiga yang di-proxy platform ini (selain theresav).
// Setiap server: key-nya HANYA dari environment variable (keyEnv) — tidak pernah ditulis di repo,
// tidak pernah dikembalikan ke user atau masuk log. Set nilainya di Vercel → Project → Settings →
// Environment Variables.
//
//   keyMode : 'query'  -> key dikirim sebagai query param (?<keyName>=KEY)   [paling umum]
//             'header'  -> key dikirim sebagai header (<keyName>: KEY)
//   keyName : nama param/header untuk key (default 'apikey')
//
// Kalau ternyata sebuah server memakai cara berbeda (mis. header 'x-api-key'), cukup ubah keyMode
// / keyName di sini — tidak perlu sentuh kode endpoint-nya.
module.exports = {
  clutch:   { base: 'https://api.clutch.web.id', keyEnv: 'CLUTCH_API_KEY',   keyMode: 'query', keyName: 'apikey' },
  dongtube: { base: 'https://api.dongtube.id',   keyEnv: 'DONGTUBE_API_KEY', keyMode: 'query', keyName: 'apikey' },
  pitucode: { base: 'https://api.pitucode.com',  keyEnv: 'PITUCODE_API_KEY', keyMode: 'query', keyName: 'apikey' },
  termai:   { base: 'https://termai.cc',          keyEnv: 'TERMAI_API_KEY',   keyMode: 'query', keyName: 'apikey' }
};
