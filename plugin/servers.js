// Endpoint yang di-proxy ke server pihak ketiga (clutch, dongtube, pitucode, termai) lewat
// lib/apiproxy.js. Server + key diatur di config/apiServers.js (key dari ENV di Vercel).
//
// Cara menambah endpoint: tambahkan satu objek spec ke array di bawah, lalu makeEndpoint() akan
// mendaftarkannya sebagai route. Bentuk spec:
//
//   { server: 'dongtube',                 // id server di config/apiServers.js
//     name: 'YouTube MP3',                // judul di katalog
//     desc: 'Unduh audio YouTube (mp3).', // keterangan
//     category: 'Downloader',             // folder kategori
//     path: '/api/download/ytmp3',        // alamat publik di web ini
//     upstream: '/download/ytmp3',        // path di server asli (tanpa ?apikey, itu ditambah otomatis)
//     params: [{ name: 'url', required: true, type: 'url', placeholder: 'https://youtu.be/...' }],
//     sample: { url: 'https://youtu.be/dQw4w9WgXcQ' } }  // dipakai "Uji endpoint" (opsional)
//
// Untuk endpoint yang butuh FOTO/FILE (unggah, bukan link):
//   { ..., multipart: true, file: { param: 'image', field: 'image', accept: 'image/*' },
//     params: [{ name: 'image', required: true, type: 'file' }] }
//
// Belum ada endpoint yang terdaftar: menunggu daftar path/parameter resmi tiap server.
const { makeEndpoint } = require('../lib/apiproxy');

const SPECS = [
  // Tambahkan spec endpoint di sini.
];

module.exports = SPECS.map(makeEndpoint);
