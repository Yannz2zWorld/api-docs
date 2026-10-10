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
const X = path => '/api/alt2' + path;  // BOTCAHX backups (plugin/botcahx.js)

module.exports = [
  // ---------------------------------------------------------------- Downloader
  { path: '/api/download/tiktok', backups: ['/api/download/tiktok-v2', D('/download/tiktok'), '/api/download/aio', D('/download/aio'), X('/download/tiktok')] },
  { path: '/api/download/instagram', backups: ['/api/download/kolid', '/api/download/aio', D('/download/aio')] },
  { path: '/api/download/youtube', backups: [{ path: '/api/download/ytmp4', query: { url: 'url', resolution: { value: '360' } } }, D('/download/youtube'), D('/download/youtube-v2'), '/api/download/aio', D('/download/savefrom'), { path: X('/download/youtube'), query: { url: 'url' } }] },
  { path: '/api/download/ytmp3', backups: [{ path: D('/download/ytmp3'), query: { url: 'url' } }, { path: D('/download/ytmp3-v2'), query: { url: 'url' } },
    { path: D('/download/youtube-v3'), query: { url: 'url', type: { value: 'audio' }, quality: { value: '128' } } }, { path: D('/downloader/cnvmp3'), query: { url: 'url', type: { value: 'mp3' } } }] },
  { path: '/api/download/play', backups: [{ path: D('/youtube/play'), query: { input: 'query' } }, { path: D('/spotify/play'), query: { input: 'query' } }] },
  { path: '/api/download/aio', backups: [D('/download/aio'), D('/download/savefrom')] },
  { path: '/api/download/capcut', backups: [D('/download/capcut'), X('/download/capcut')] },
  { path: '/api/download/facebook', backups: [D('/download/facebook'), X('/download/facebook')] },
  { path: '/api/download/mediafire', backups: [D('/download/mediafire'), D('/download/mediafire-v2')] },
  { path: '/api/download/pinterest', backups: [D('/download/pinterest-v3')] },
  { path: '/api/download/spotify', backups: [D('/download/spotify-v2')] },
  { path: '/api/download/threads', backups: [D('/download/threads-v2'), D('/download/threads-v3')] },
  { path: '/api/download/twitter', backups: [D('/download/twitter'), D('/download/twitter-v2')] },

  // ---------------------------------------------------------------- AI
  { path: '/api/ai/chatgpt', backups: [{ path: D('/ai/chatgpt'), query: { q: 'prompt' } }, { path: '/api/ai/gpt', query: { text: 'prompt' } }, { path: X('/ai/openai-chat'), query: { text: 'prompt' } }, { path: X('/ai/gpt'), query: { text: 'prompt' } }] },
  { path: '/api/ai/claude', backups: [{ path: D('/ai/claude'), query: { q: 'text' } }] },
  { path: '/api/ai/copilot', backups: [{ path: D('/ai/copilot'), query: { q: 'prompt' } }] },
  { path: '/api/ai/unlimited', backups: [{ path: D('/ai/unlimited'), query: { q: 'text' } }] },

  // ---------------------------------------------------------------- Maker / Canvas / Image
  { path: '/api/maker/brat', backups: [{ path: D('/canvas/brat'), query: { text: 'text' } }, { path: D('/maker/brat'), query: { text: 'text' } }, { path: X('/maker/brat'), query: { text: 'text' } }] },
  { path: '/api/maker/bratvid', backups: [{ path: D('/canvas/bratvid'), query: { text: 'text', format: 'format' } }, { path: X('/maker/bratvid'), query: { text: 'text' } }] },
  { path: '/api/maker/remini', backups: [{ path: D('/tools/remini'), query: { url: 'url' } }, { path: D('/tools/ihancer'), query: { url: 'url' } }, { path: X('/tools/remini'), query: { url: 'url' } }] },
  { path: '/api/canvas/iqc', backups: [{ path: D('/maker/iqc'), query: { text: 'text' } }, { path: X('/maker/iqc'), query: { text: 'text' } }] },
  { path: '/api/tools/compress', backups: [{ path: D('/imgedit/tinypng'), query: { url: 'url' } }, { path: D('/tools/iloveimg-compress'), query: { url: 'url' } }] },
  { path: '/api/tools/removebg', backups: [{ path: D('/tools/iloveimg-removebg'), query: { url: 'url' } }, { path: X('/tools/removebg'), query: { url: 'url' } }] },
  { path: '/api/tools/upscale', backups: [{ path: D('/tools/iloveimg-upscale'), query: { url: 'url', scale: 'factor' } }] },
  { path: '/api/tools/resize', backups: [{ path: D('/tools/iloveimg-resize'), query: { url: 'url', width: 'width', height: 'height' } }] },

  // ---------------------------------------------------------------- Search / Stalk
  { path: '/api/search/pinterest', backups: [D('/search/pinterest'), D('/search/pinterest-v2'), { path: X('/search/pinterest'), query: { text1: 'q' } }] },
  { path: '/api/search/tiktok', backups: [{ path: D('/tiktok/search'), query: { keyword: 'q' } }] },
  { path: '/api/search/youtube', backups: [D('/search/youtube'), { path: X('/search/youtube'), query: { query: 'q' } }] },
  { path: '/api/search/npm', backups: [D('/check/npm')] },
  { path: '/api/search/stickerly', backups: [D('/search/stickerly'), D('/search/sticker')] },
  { path: '/api/search/spotify-lirik', backups: [{ path: D('/search/lyrics'), query: { q: 'title' } }, { path: D('/search/musixmatch'), query: { q: 'title' } }, { path: X('/search/lirik'), query: { lirik: 'title' } }] },
  { path: '/api/search/kbbi', backups: [{ path: D('/tools/kbbi'), query: { word: 'q' } }, { path: X('/search/kbbi'), query: { text: 'q' } }] },
  { path: '/api/search/image', backups: [{ path: D('/search/googleimg'), query: { q: 'q' } }] },
  { path: '/api/stalk/github', backups: [{ path: D('/stalk/github'), query: { user: 'username' } }] },
  { path: '/api/stalk/instagram', backups: [{ path: D('/stalk/instagram-v2'), query: { user: 'username' } }, { path: X('/stalk/instagram'), query: { username: 'username' } }] },
  { path: '/api/stalk/tiktok', backups: [{ path: D('/stalk/tiktok'), query: { user: 'username' } }, { path: D('/stalk/tiktok-v2'), query: { user: 'username' } }, { path: D('/stalk/tiktok-v3'), query: { user: 'username' } }, { path: X('/stalk/tiktok'), query: { username: 'username' } }] },
  { path: '/api/check/mlbb', backups: [{ path: D('/check/mlbb-region'), query: { user_id: 'uid', zone_id: 'zone' } }, { path: D('/check/mlbb-diamonds'), query: { user_id: 'uid', zone_id: 'zone' } }, { path: X('/check/mlbb'), query: { id: 'uid', server: 'zone' } }] },

  // ---------------------------------------------------------------- Tools
  { path: '/api/tools/text-to-speech', backups: [{ path: D('/tools/tts'), query: { text: 'text' } }, { path: D('/tools/google-tts'), query: { text: 'text' } }, { path: D('/tools/edge-tts'), query: { text: 'text' } }] },
  { path: '/api/tools/ocr', backups: [{ path: '/api/tools/vision', query: { url: 'url', mode: { value: 'ocr' } } }] },
  { path: '/api/tools/screenshot', backups: [{ path: D('/tools/ssweb'), query: { url: 'url' } }, { path: X('/tools/ssweb'), query: { url: 'url', device: { value: 'desktop' } } }] },
  { path: '/api/tools/translate', backups: [{ path: D('/tools/translate-v2'), query: { text: 'text', from: 'source', to: 'target' } }, { path: D('/ai/cf-translate'), query: { text: 'text', to: 'target' } }, { path: X('/tools/translate'), query: { text: 'text', lang: 'target' } }] },

  // ---------------------------------------------------------------- Games / Primbon / Random
  { path: '/api/games/susunkata', backups: [D('/games/susun-kata'), X('/games/susunkata')] },
  { path: '/api/games/tebakbendera', backups: [D('/games/tebak-bendera'), X('/games/tebakbendera')] },
  { path: '/api/games/tebakgambar', backups: [D('/games/tebak-gambar'), X('/games/tebakgambar')] },
  { path: '/api/games/tebakgame', backups: [D('/games/tebak-game')] },
  { path: '/api/games/tebakheroml', backups: [D('/games/tebak-heroml')] },
  { path: '/api/games/tebakkata', backups: [D('/games/tebak-kata'), X('/games/tebakkata')] },
  { path: '/api/primbon/cocokpasangan', backups: [D('/primbon/cocok-pasangan')] },
  { path: '/api/random/anime-quote', backups: [D('/random/anime-quotes'), D('/random/quotesanime'), X('/random/quotesanime')] },
  // ---------------------------------------------------------------- BOTCAHX backups for endpoints that had none
  { path: '/api/download/gdrive', backups: [X('/download/gdrive')] },
  { path: '/api/download/soundcloud', backups: [X('/download/soundcloud')] },
  { path: '/api/ai/gpt', backups: [{ path: X('/ai/gpt'), query: { text: 'text' } }] },
  { path: '/api/ai/bard', backups: [{ path: X('/ai/bard'), query: { text: 'query' } }] },
  { path: '/api/maker/carbon', backups: [{ path: X('/maker/carbon'), query: { text: 'code' } }] },
  { path: '/api/info/cuaca/v2', backups: [{ path: X('/info/cuaca'), query: { query: 'kota' } }] },
  { path: '/api/search/spotify', backups: [{ path: X('/search/spotify'), query: { query: 'q' } }] },
  { path: '/api/search/wikipedia', backups: [{ path: X('/search/wikipedia'), query: { text: 'q' } }] },
  { path: '/api/stalk/twitter', backups: [{ path: X('/stalk/twitter'), query: { username: 'username' } }] },
  { path: '/api/stalk/genshin', backups: [{ path: X('/stalk/genshin'), query: { id: 'uid' } }] },
  { path: '/api/stalk/roblox', backups: [{ path: X('/stalk/roblox'), query: { username: 'user' } }] },
  { path: '/api/primbon/artinama', backups: [{ path: X('/primbon/artinama'), query: { nama: 'nama' } }] },
  { path: '/api/news/cnn', backups: [X('/news/cnn')] },
  { path: '/api/news/cnbc', backups: [X('/news/cnbc')] },
  { path: '/api/news/kompas', backups: [X('/news/kompas')] },
  { path: '/api/random/kata-motivasi', backups: [X('/random/motivasi')] },
  { path: '/api/games/asahotak', backups: [X('/games/asahotak')] },
  { path: '/api/games/family100', backups: [X('/games/family100')] },
  { path: '/api/games/siapa-dia', backups: [X('/games/siapa-dia')] },
  { path: '/api/games/tebak-kabupaten', backups: [X('/games/tebak-kabupaten')] },
  { path: '/api/games/tebak-kimia', backups: [X('/games/tebak-kimia')] },
  { path: '/api/games/tebak-lagu', backups: [X('/games/tebak-lagu')] },
  { path: '/api/games/tebak-lirik', backups: [X('/games/tebak-lirik')] },
  { path: '/api/games/tebak-tebakan', backups: [X('/games/tebak-tebakan')] }
];
