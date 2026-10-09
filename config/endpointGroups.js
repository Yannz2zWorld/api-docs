'use strict';
// Endpoint cadangan (failover). Tiap grup = satu endpoint publik + endpoint lain yang fungsinya sama.
// Kalau yang dipakai gagal (server error, timeout, kuota/plan habis, key ditolak), gateway otomatis
// nyoba cadangan berikutnya sampai ada yang jalan. Urutan di sini = prioritas, tapi yang lagi rusak
// (cek otomatis gagal / disembunyikan) selalu dicoba paling akhir. Endpoint publiknya baru
// disembunyikan kalau SEMUA anggota grup lagi rusak, dan muncul lagi begitu salah satunya jalan.
//
//   path    : endpoint publik (yang dipanggil user)
//   backups : cadangan, urut prioritas. String path, atau { path, query } kalau cadangannya butuh
//             parameter tambahan / nama parameter beda: query = { namaDiCadangan: 'namaDiUtama' | { value } }.
//
// Cadangan boleh endpoint publik lain (mis. AIO) atau endpoint "backupOnly" yang nggak ditampilkan
// sendiri (mis. dari api-faa.my.id).
module.exports = [
  { path: '/api/download/tiktok', backups: ['/api/download/tiktok-termai', '/api/download/aio'] },
  { path: '/api/download/instagram', backups: ['/api/download/kolid', '/api/download/aio'] },
  { path: '/api/download/youtube', backups: [{ path: '/api/download/ytmp4', query: { url: 'url', resolution: { value: '360' } } }, '/api/download/aio'] }
];
