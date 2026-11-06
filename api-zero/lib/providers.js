'use strict';
// Provider asli. File ini hanya dibaca di server: nama, alamat, dan key provider TIDAK PERNAH
// dikirim ke browser/pemanggil API. Key diambil dari environment variable (lihat .env.example).
//
//   keyMode : 'query'  -> key dikirim sebagai ?<keyName>=KEY
//             'header' -> key dikirim sebagai header <keyName>: KEY
//             'none'   -> provider publik tanpa key
//   strip   : field branding provider yang dibuang dari respons JSON
const COMMON_STRIP = ['creator', 'author', 'channel', 'owner', 'developer', 'dev', 'by', 'credit', 'credits', 'apikey', 'timestamp', 'response_time', 'responseTime', 'website', 'source'];

module.exports = {
  theresav: { base: 'https://api.theresav.eu',    keyEnv: 'THERESAV_API_KEY', keyMode: 'header', keyName: 'x-apikey', strip: COMMON_STRIP },
  botcahx:  { base: 'https://api.botcahx.eu.org', keyEnv: 'BOTCAHX_API_KEY',  keyMode: 'query',  keyName: 'apikey',   strip: [...COMMON_STRIP, 'code'] },
  dongtube: { base: 'https://api.dongtube.id',    keyEnv: 'DONGTUBE_API_KEY', keyMode: 'query',  keyName: 'apikey',   strip: COMMON_STRIP },
  nexray:   { base: 'https://api.nexray.eu.cc',   keyEnv: null,               keyMode: 'none',                        strip: COMMON_STRIP },
  faa:      { base: 'https://api-faa.my.id',      keyEnv: null,               keyMode: 'none',                        strip: COMMON_STRIP }
};
