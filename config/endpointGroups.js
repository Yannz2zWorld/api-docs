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
// sendiri (mis. dari Dongtube: /api/alt/...).
const D = path => '/api/alt' + path;   // Dongtube backups (plugin/dongtube.js)

module.exports = [
  // ---------------------------------------------------------------- Downloader
  { path: '/api/download/tiktok', backups: ['/api/download/tiktok-v2', D('/download/tiktok'), '/api/download/aio', D('/download/aio')] },
  { path: '/api/download/instagram', backups: ['/api/download/kolid', '/api/download/aio', D('/download/aio')] },
  { path: '/api/download/youtube', backups: [{ path: '/api/download/ytmp4', query: { url: 'url', resolution: { value: '360' } } }, D('/download/youtube'), D('/download/youtube-v2'), '/api/download/aio', D('/download/savefrom')] },
  { path: '/api/download/ytmp3', backups: [{ path: D('/download/ytmp3'), query: { url: 'url' } }, { path: D('/download/ytmp3-v2'), query: { url: 'url' } },
    { path: D('/download/youtube-v3'), query: { url: 'url', type: { value: 'audio' }, quality: { value: '128' } } }, { path: D('/downloader/cnvmp3'), query: { url: 'url', type: { value: 'mp3' } } }] },
  { path: '/api/download/play', backups: [{ path: D('/youtube/play'), query: { input: 'query' } }, { path: D('/spotify/play'), query: { input: 'query' } }] },
  { path: '/api/download/aio', backups: [D('/download/aio'), D('/download/savefrom')] },
  { path: '/api/download/capcut', backups: [D('/download/capcut')] },
  { path: '/api/download/facebook', backups: [D('/download/facebook')] },
  { path: '/api/download/mediafire', backups: [D('/download/mediafire'), D('/download/mediafire-v2')] },
  { path: '/api/download/pinterest', backups: [D('/download/pinterest-v3')] },
  { path: '/api/download/spotify', backups: [D('/download/spotify-v2')] },
  { path: '/api/download/threads', backups: [D('/download/threads-v2'), D('/download/threads-v3')] },
  { path: '/api/download/twitter', backups: [D('/download/twitter'), D('/download/twitter-v2')] },

  // ---------------------------------------------------------------- AI
  { path: '/api/ai/chatgpt', backups: [{ path: D('/ai/chatgpt'), query: { q: 'prompt' } }, { path: '/api/ai/gpt', query: { text: 'prompt' } }] },
  { path: '/api/ai/claude', backups: [{ path: D('/ai/claude'), query: { q: 'text' } }] },
  { path: '/api/ai/copilot', backups: [{ path: D('/ai/copilot'), query: { q: 'prompt' } }] },
  { path: '/api/ai/unlimited', backups: [{ path: D('/ai/unlimited'), query: { q: 'text' } }] },

  // ---------------------------------------------------------------- Maker / Canvas / Image
  { path: '/api/maker/brat', backups: [{ path: D('/canvas/brat'), query: { text: 'text' } }, { path: D('/maker/brat'), query: { text: 'text' } }] },
  { path: '/api/maker/bratvid', backups: [{ path: D('/canvas/bratvid'), query: { text: 'text', format: 'format' } }] },
  { path: '/api/maker/remini', backups: [{ path: D('/tools/remini'), query: { url: 'url' } }, { path: D('/tools/ihancer'), query: { url: 'url' } }] },
  { path: '/api/canvas/iqc', backups: [{ path: D('/maker/iqc'), query: { text: 'text' } }] },
  { path: '/api/tools/compress', backups: [{ path: D('/imgedit/tinypng'), query: { url: 'url' } }, { path: D('/tools/iloveimg-compress'), query: { url: 'url' } }] },
  { path: '/api/tools/removebg', backups: [{ path: D('/tools/iloveimg-removebg'), query: { url: 'url' } }] },
  { path: '/api/tools/upscale', backups: [{ path: D('/tools/iloveimg-upscale'), query: { url: 'url', scale: 'factor' } }] },
  { path: '/api/tools/resize', backups: [{ path: D('/tools/iloveimg-resize'), query: { url: 'url', width: 'width', height: 'height' } }] },

  // ---------------------------------------------------------------- Search / Stalk
  { path: '/api/search/pinterest', backups: [D('/search/pinterest'), D('/search/pinterest-v2')] },
  { path: '/api/search/tiktok', backups: [{ path: D('/tiktok/search'), query: { keyword: 'q' } }] },
  { path: '/api/search/youtube', backups: [D('/search/youtube')] },
  { path: '/api/search/npm', backups: [D('/check/npm')] },
  { path: '/api/search/stickerly', backups: [D('/search/stickerly'), D('/search/sticker')] },
  { path: '/api/search/spotify-lirik', backups: [{ path: D('/search/lyrics'), query: { q: 'title' } }, { path: D('/search/musixmatch'), query: { q: 'title' } }] },
  { path: '/api/search/kbbi', backups: [{ path: D('/tools/kbbi'), query: { word: 'q' } }] },
  { path: '/api/search/image', backups: [{ path: D('/search/googleimg'), query: { q: 'q' } }] },
  { path: '/api/stalk/github', backups: [{ path: D('/stalk/github'), query: { user: 'username' } }] },
  { path: '/api/stalk/instagram', backups: [{ path: D('/stalk/instagram-v2'), query: { user: 'username' } }] },
  { path: '/api/stalk/tiktok', backups: [{ path: D('/stalk/tiktok'), query: { user: 'username' } }, { path: D('/stalk/tiktok-v2'), query: { user: 'username' } }, { path: D('/stalk/tiktok-v3'), query: { user: 'username' } }] },
  { path: '/api/check/mlbb', backups: [{ path: D('/check/mlbb-region'), query: { user_id: 'uid', zone_id: 'zone' } }, { path: D('/check/mlbb-diamonds'), query: { user_id: 'uid', zone_id: 'zone' } }] },

  // ---------------------------------------------------------------- Tools
  { path: '/api/tools/text-to-speech', backups: [{ path: D('/tools/tts'), query: { text: 'text' } }, { path: D('/tools/google-tts'), query: { text: 'text' } }, { path: D('/tools/edge-tts'), query: { text: 'text' } }] },
  { path: '/api/tools/ocr', backups: [{ path: '/api/tools/vision', query: { url: 'url', mode: { value: 'ocr' } } }] },
  { path: '/api/tools/screenshot', backups: [{ path: D('/tools/ssweb'), query: { url: 'url' } }] },
  { path: '/api/tools/translate', backups: [{ path: D('/tools/translate-v2'), query: { text: 'text', from: 'source', to: 'target' } }, { path: D('/ai/cf-translate'), query: { text: 'text', to: 'target' } }] },

  // ---------------------------------------------------------------- Games / Primbon / Random
  { path: '/api/games/susunkata', backups: [D('/games/susun-kata')] },
  { path: '/api/games/tebakbendera', backups: [D('/games/tebak-bendera')] },
  { path: '/api/games/tebakgambar', backups: [D('/games/tebak-gambar')] },
  { path: '/api/games/tebakgame', backups: [D('/games/tebak-game')] },
  { path: '/api/games/tebakheroml', backups: [D('/games/tebak-heroml')] },
  { path: '/api/games/tebakkata', backups: [D('/games/tebak-kata')] },
  { path: '/api/primbon/cocokpasangan', backups: [D('/primbon/cocok-pasangan')] },
  { path: '/api/random/anime-quote', backups: [D('/random/anime-quotes'), D('/random/quotesanime')] }
];
