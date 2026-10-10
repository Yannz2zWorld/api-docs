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
const N = path => '/api/alt3' + path;  // NexRay backups (plugin/nexray.js)

module.exports = [
  // ---------------------------------------------------------------- Downloader
  { path: '/api/download/tiktok', backups: ['/api/download/tiktok-v2', D('/download/tiktok'), '/api/download/aio', D('/download/aio'), X('/download/tiktok'), '/api/download/tiktok-v3'] },
  { path: '/api/download/instagram', backups: ['/api/download/kolid', '/api/download/aio', D('/download/aio'), N('/downloader/instagram'), N('/downloader/v1/instagram'), N('/downloader/v2/instagram')] },
  { path: '/api/download/youtube', backups: [{ path: '/api/download/ytmp4', query: { url: 'url', resolution: { value: '360' } } }, D('/download/youtube'), D('/download/youtube-v2'), '/api/download/aio', D('/download/savefrom'), { path: X('/download/youtube'), query: { url: 'url' } }, '/api/download/youtube-v2'] },
  { path: '/api/download/ytmp3', backups: [{ path: D('/download/ytmp3'), query: { url: 'url' } }, { path: D('/download/ytmp3-v2'), query: { url: 'url' } },
    { path: D('/download/youtube-v3'), query: { url: 'url', type: { value: 'audio' }, quality: { value: '128' } } }, { path: D('/downloader/cnvmp3'), query: { url: 'url', type: { value: 'mp3' } } }, N('/downloader/ytmp3'), N('/downloader/v1/ytmp3')] },
  { path: '/api/download/play', backups: [{ path: D('/youtube/play'), query: { input: 'query' } }, { path: D('/spotify/play'), query: { input: 'query' } }, '/api/download/play-v2', '/api/download/play-v3'] },
  { path: '/api/download/aio', backups: [D('/download/aio'), D('/download/savefrom'), '/api/download/aio-v2'] },
  { path: '/api/download/capcut', backups: [D('/download/capcut'), X('/download/capcut'), N('/downloader/capcut'), '/api/download/capcut-v2'] },
  { path: '/api/download/facebook', backups: [D('/download/facebook'), X('/download/facebook'), '/api/download/facebook-v2'] },
  { path: '/api/download/mediafire', backups: [D('/download/mediafire'), D('/download/mediafire-v2'), '/api/download/mediafire-v2'] },
  { path: '/api/download/pinterest', backups: [D('/download/pinterest-v3'), '/api/download/pinterest-v2'] },
  { path: '/api/download/spotify', backups: [D('/download/spotify-v2'), '/api/download/spotify-v2', N('/downloader/v1/spotify')] },
  { path: '/api/download/threads', backups: [D('/download/threads-v2'), D('/download/threads-v3'), N('/downloader/threads')] },
  { path: '/api/download/twitter', backups: [D('/download/twitter'), D('/download/twitter-v2'), '/api/download/twitter-v2'] },

  // ---------------------------------------------------------------- AI
  { path: '/api/ai/chatgpt', backups: [{ path: D('/ai/chatgpt'), query: { q: 'prompt' } }, { path: '/api/ai/gpt', query: { text: 'prompt' } }, { path: X('/ai/openai-chat'), query: { text: 'prompt' } }, { path: X('/ai/gpt'), query: { text: 'prompt' } }, N('/ai/chatgpt')] },
  { path: '/api/ai/claude', backups: [{ path: D('/ai/claude'), query: { q: 'text' } }, '/api/ai/claude-v2'] },
  { path: '/api/ai/copilot', backups: [{ path: D('/ai/copilot'), query: { q: 'prompt' } }, '/api/ai/copilot-v2'] },
  { path: '/api/ai/unlimited', backups: [{ path: D('/ai/unlimited'), query: { q: 'text' } }] },

  // ---------------------------------------------------------------- Maker / Canvas / Image
  { path: '/api/maker/brat', backups: [{ path: D('/canvas/brat'), query: { text: 'text' } }, { path: D('/maker/brat'), query: { text: 'text' } }, { path: X('/maker/brat'), query: { text: 'text' } }, '/api/maker/brat-v2'] },
  { path: '/api/maker/bratvid', backups: [{ path: D('/canvas/bratvid'), query: { text: 'text', format: 'format' } }, { path: X('/maker/bratvid'), query: { text: 'text' } }, '/api/maker/bratvid-v2'] },
  { path: '/api/maker/remini', backups: [{ path: D('/tools/remini'), query: { url: 'url' } }, { path: D('/tools/ihancer'), query: { url: 'url' } }, { path: X('/tools/remini'), query: { url: 'url' } }, '/api/maker/remini-v2'] },
  { path: '/api/canvas/iqc', backups: [{ path: D('/maker/iqc'), query: { text: 'text' } }, { path: X('/maker/iqc'), query: { text: 'text' } }, '/api/canvas/iqc-v2', N('/maker/v1/iqc')] },
  { path: '/api/tools/compress', backups: [{ path: D('/imgedit/tinypng'), query: { url: 'url' } }, { path: D('/tools/iloveimg-compress'), query: { url: 'url' } }] },
  { path: '/api/tools/removebg', backups: [{ path: D('/tools/iloveimg-removebg'), query: { url: 'url' } }, { path: X('/tools/removebg'), query: { url: 'url' } }, '/api/tools/removebg-v2', N('/tools/v1/removebg'), N('/tools/v2/removebg')] },
  { path: '/api/tools/upscale', backups: [{ path: D('/tools/iloveimg-upscale'), query: { url: 'url', scale: 'factor' } }, '/api/tools/upscale-v2', N('/tools/v2/upscale'), N('/tools/v3/upscale'), N('/tools/v5/upscale')] },
  { path: '/api/tools/resize', backups: [{ path: D('/tools/iloveimg-resize'), query: { url: 'url', width: 'width', height: 'height' } }] },

  // ---------------------------------------------------------------- Search / Stalk
  { path: '/api/search/pinterest', backups: [D('/search/pinterest'), D('/search/pinterest-v2'), { path: X('/search/pinterest'), query: { text1: 'q' } }, '/api/search/pinterest-v2'] },
  { path: '/api/search/tiktok', backups: [{ path: D('/tiktok/search'), query: { keyword: 'q' } }, '/api/search/tiktok-v2'] },
  { path: '/api/search/youtube', backups: [D('/search/youtube'), { path: X('/search/youtube'), query: { query: 'q' } }, '/api/search/youtube-v2'] },
  { path: '/api/search/npm', backups: [D('/check/npm'), '/api/search/npm-v2', '/api/search/npm-v3', '/api/search/npm-v4'] },
  { path: '/api/search/stickerly', backups: [D('/search/stickerly'), D('/search/sticker'), '/api/search/stickerly-v2'] },
  { path: '/api/search/spotify-lirik', backups: [{ path: D('/search/lyrics'), query: { q: 'title' } }, { path: D('/search/musixmatch'), query: { q: 'title' } }, { path: X('/search/lirik'), query: { lirik: 'title' } }, '/api/search/spotify-lirik-v2'] },
  { path: '/api/search/kbbi', backups: [{ path: D('/tools/kbbi'), query: { word: 'q' } }, { path: X('/search/kbbi'), query: { text: 'q' } }] },
  { path: '/api/search/image', backups: [{ path: D('/search/googleimg'), query: { q: 'q' } }, N('/search/bingimage'), N('/search/googleimage')] },
  { path: '/api/stalk/github', backups: [{ path: D('/stalk/github'), query: { user: 'username' } }, '/api/stalk/github-v2'] },
  { path: '/api/stalk/instagram', backups: [{ path: D('/stalk/instagram-v2'), query: { user: 'username' } }, { path: X('/stalk/instagram'), query: { username: 'username' } }, N('/stalker/instagram')] },
  { path: '/api/stalk/tiktok', backups: [{ path: D('/stalk/tiktok'), query: { user: 'username' } }, { path: D('/stalk/tiktok-v2'), query: { user: 'username' } }, { path: D('/stalk/tiktok-v3'), query: { user: 'username' } }, { path: X('/stalk/tiktok'), query: { username: 'username' } }, '/api/stalk/tiktok-v2'] },
  { path: '/api/check/mlbb', backups: [{ path: D('/check/mlbb-region'), query: { user_id: 'uid', zone_id: 'zone' } }, { path: D('/check/mlbb-diamonds'), query: { user_id: 'uid', zone_id: 'zone' } }, { path: X('/check/mlbb'), query: { id: 'uid', server: 'zone' } }, N('/stalker/mlbb'), N('/stalker/v1/mlbb'), N('/stalker/v2/mlbb')] },

  // ---------------------------------------------------------------- Tools
  { path: '/api/tools/text-to-speech', backups: [{ path: D('/tools/tts'), query: { text: 'text' } }, { path: D('/tools/google-tts'), query: { text: 'text' } }, { path: D('/tools/edge-tts'), query: { text: 'text' } }, N('/tools/tts-google')] },
  { path: '/api/tools/ocr', backups: [{ path: '/api/tools/vision', query: { url: 'url', mode: { value: 'ocr' } } }, '/api/tools/ocr-v2'] },
  { path: '/api/tools/screenshot', backups: [{ path: D('/tools/ssweb'), query: { url: 'url' } }, { path: X('/tools/ssweb'), query: { url: 'url', device: { value: 'desktop' } } }, '/api/tools/screenshot-v2'] },
  { path: '/api/tools/translate', backups: [{ path: D('/tools/translate-v2'), query: { text: 'text', from: 'source', to: 'target' } }, { path: D('/ai/cf-translate'), query: { text: 'text', to: 'target' } }, { path: X('/tools/translate'), query: { text: 'text', lang: 'target' } }, '/api/tools/translate-v2'] },

  // ---------------------------------------------------------------- Games / Primbon / Random
  { path: '/api/games/susunkata', backups: [D('/games/susun-kata'), X('/games/susunkata'), '/api/games/susunkata-v2'] },
  { path: '/api/games/tebakbendera', backups: [D('/games/tebak-bendera'), X('/games/tebakbendera')] },
  { path: '/api/games/tebakgambar', backups: [D('/games/tebak-gambar'), X('/games/tebakgambar')] },
  { path: '/api/games/tebakgame', backups: [D('/games/tebak-game')] },
  { path: '/api/games/tebakheroml', backups: [D('/games/tebak-heroml')] },
  { path: '/api/games/tebakkata', backups: [D('/games/tebak-kata'), X('/games/tebakkata')] },
  { path: '/api/primbon/cocokpasangan', backups: [D('/primbon/cocok-pasangan'), '/api/primbon/cocokpasangan-v2'] },
  { path: '/api/random/anime-quote', backups: [D('/random/anime-quotes'), D('/random/quotesanime'), X('/random/quotesanime')] },
  // ---------------------------------------------------------------- BOTCAHX backups for endpoints that had none
  { path: '/api/download/gdrive', backups: [X('/download/gdrive'), '/api/download/gdrive-v2'] },
  { path: '/api/download/soundcloud', backups: [X('/download/soundcloud'), N('/downloader/soundcloud')] },
  { path: '/api/ai/gpt', backups: [{ path: X('/ai/gpt'), query: { text: 'text' } }] },
  { path: '/api/ai/bard', backups: [{ path: X('/ai/bard'), query: { text: 'query' } }] },
  { path: '/api/maker/carbon', backups: [{ path: X('/maker/carbon'), query: { text: 'code' } }, '/api/maker/carbon-v2'] },
  { path: '/api/info/cuaca/v2', backups: [{ path: X('/info/cuaca'), query: { query: 'kota' } }] },
  { path: '/api/search/spotify', backups: [{ path: X('/search/spotify'), query: { query: 'q' } }, '/api/search/spotify-v2', N('/search/v1/spotify')] },
  { path: '/api/search/wikipedia', backups: [{ path: X('/search/wikipedia'), query: { text: 'q' } }, '/api/search/wikipedia-v2'] },
  { path: '/api/stalk/twitter', backups: [{ path: X('/stalk/twitter'), query: { username: 'username' } }, N('/stalker/twitter')] },
  { path: '/api/stalk/genshin', backups: [{ path: X('/stalk/genshin'), query: { id: 'uid' } }, '/api/stalk/genshin-v2'] },
  { path: '/api/stalk/roblox', backups: [{ path: X('/stalk/roblox'), query: { username: 'user' } }, '/api/stalk/roblox-v2'] },
  { path: '/api/primbon/artinama', backups: [{ path: X('/primbon/artinama'), query: { nama: 'nama' } }, '/api/primbon/artinama-v2'] },
  { path: '/api/news/cnn', backups: [X('/news/cnn'), '/api/news/cnn-v2'] },
  { path: '/api/news/cnbc', backups: [X('/news/cnbc'), '/api/news/cnbc-v2'] },
  { path: '/api/news/kompas', backups: [X('/news/kompas'), '/api/news/kompas-v2'] },
  { path: '/api/random/kata-motivasi', backups: [X('/random/motivasi')] },
  { path: '/api/games/asahotak', backups: [X('/games/asahotak'), '/api/games/asahotak-v2'] },
  { path: '/api/games/family100', backups: [X('/games/family100')] },
  { path: '/api/games/siapa-dia', backups: [X('/games/siapa-dia'), '/api/games/siapa-dia-v2'] },
  { path: '/api/games/tebak-kabupaten', backups: [X('/games/tebak-kabupaten')] },
  { path: '/api/games/tebak-kimia', backups: [X('/games/tebak-kimia'), '/api/games/tebak-kimia-v2'] },
  { path: '/api/games/tebak-lagu', backups: [X('/games/tebak-lagu')] },
  { path: '/api/games/tebak-lirik', backups: [X('/games/tebak-lirik'), '/api/games/tebak-lirik-v2'] },
  { path: '/api/games/tebak-tebakan', backups: [X('/games/tebak-tebakan'), '/api/games/tebak-tebakan-v2'] },

  // ---------------------------------------------------------------- NexRay: next versions + backups (plugin/nexray.js)
  { path: '/api/ai/gemini', backups: [N('/ai/gemini')] },
  { path: '/api/tools/grammar-checker', backups: ['/api/tools/grammar-checker-v2'] },
  { path: '/api/tools/image-to-prompt', backups: ['/api/tools/image-to-prompt-v2'] },
  { path: '/api/ai/muslimai', backups: ['/api/ai/muslimai-v2'] },
  { path: '/api/ai/powerbrain', backups: ['/api/ai/powerbrain-v2'] },
  { path: '/api/ai/publicai', backups: ['/api/ai/publicai-v2'] },
  { path: '/api/ai/turboseek', backups: [N('/ai/turboseek')] },
  { path: '/api/ai/venice', backups: [N('/ai/venice')] },
  { path: '/api/ai/webpilot', backups: ['/api/ai/webpilot-v2'] },
  { path: '/api/anime/anichin/detail', backups: [N('/anime/anichin/detail')] },
  { path: '/api/anime/anichin/search', backups: [N('/anime/anichin/search')] },
  { path: '/api/news/antara', backups: ['/api/news/antara-v2'] },
  { path: '/api/news/jkt48', backups: [N('/berita/jkt48')] },
  { path: '/api/news/merdeka', backups: [N('/berita/merdeka')] },
  { path: '/api/news/sindonews', backups: ['/api/news/sindonews-v2'] },
  { path: '/api/news/suara', backups: [N('/berita/suara')] },
  { path: '/api/download/applemusic', backups: [N('/downloader/applemusic')] },
  { path: '/api/download/bilibili', backups: [N('/downloader/bilibili')] },
  { path: '/api/download/douyin', backups: [N('/downloader/douyin'), N('/downloader/v1/douyin')] },
  { path: '/api/download/github', backups: ['/api/download/github-v2'] },
  { path: '/api/download/likee', backups: [N('/downloader/likee')] },
  { path: '/api/download/xhs', backups: [N('/downloader/rednote')] },
  { path: '/api/download/scribd', backups: [N('/downloader/scribd')] },
  { path: '/api/download/sfile', backups: [N('/downloader/sfile')] },
  { path: '/api/download/snackvideo', backups: [N('/downloader/snackvideo')] },
  { path: '/api/download/terabox', backups: [N('/downloader/terabox')] },
  { path: '/api/download/ytmp4', backups: [N('/downloader/ytmp4'), N('/downloader/v1/ytmp4')] },
  { path: '/api/tools/image-ascii', backups: ['/api/tools/image-ascii-v2'] },
  { path: '/api/canvas/pixel-art', backups: ['/api/canvas/pixel-art-v2'] },
  { path: '/api/fun/alay', backups: ['/api/fun/alay-v2'] },
  { path: '/api/games/tekateki', backups: ['/api/games/tekateki-v2'] },
  { path: '/api/info/cuaca/v1', backups: [N('/information/cuaca')] },
  { path: '/api/info/gempa', backups: ['/api/info/gempa-v2'] },
  { path: '/api/info/grow-a-garden', backups: ['/api/info/grow-a-garden-v2'] },
  { path: '/api/info/hari-libur', backups: ['/api/info/hari-libur-v2'] },
  { path: '/api/info/jadwal-sholat', backups: ['/api/info/jadwal-sholat-v2'] },
  { path: '/api/maker/attp', backups: ['/api/maker/attp-v2'] },
  { path: '/api/maker/ttp', backups: ['/api/maker/ttp-v2'] },
  { path: '/api/primbon/nomorhoki', backups: ['/api/primbon/nomorhoki-v2'] },
  { path: '/api/primbon/tafsir-mimpi', backups: [N('/primbon/tafsirmimpi')] },
  { path: '/api/search/brave', backups: [N('/search/brave')] },
  { path: '/api/search/github', backups: ['/api/search/github-v2'] },
  { path: '/api/search/gsmarena', backups: [N('/search/gsmarena')] },
  { path: '/api/apk/playstore', backups: [N('/search/playstore')] },
  { path: '/api/search/resep', backups: ['/api/search/resep-v2'] },
  { path: '/api/search/soundcloud', backups: ['/api/search/soundcloud-v2'] },
  { path: '/api/stalk/tiktok-posts', backups: [N('/search/tiktokuser')] },
  { path: '/api/stalk/freefire', backups: [N('/stalker/freefire')] },
  { path: '/api/stalk/youtube', backups: ['/api/stalk/youtube-v2'] },
  { path: '/api/maker/emojitogif', backups: ['/api/maker/emojitogif-v2'] },
  { path: '/api/maker/emojimix', backups: [N('/tools/emojimix')] },
  { path: '/api/ai/nsfw-check', backups: ['/api/ai/nsfw-check-v2'] },
  { path: '/api/tools/text2qr', backups: ['/api/tools/text2qr-v2'] },
  { path: '/api/download/telestick', backups: ['/api/download/telestick-v2'] },
  { path: '/api/analyze/tiktok-hashtag', backups: ['/api/analyze/tiktok-hashtag-v2'] },
  { path: '/api/tools/username-gen', backups: ['/api/tools/username-gen-v2'] },
  { path: '/api/canvas/welcomeleave', backups: [{ path: N('/canvas/v2/welcomeleave'), query: { title: 'title', description: 'description', avatar: 'avatar', background: 'background', border: { value: '#2a2e35' }, avatarborder: { value: '#FFFFFF' } } }] },
  { path: '/api/tools/dewatermark', backups: [N('/tools/dewatermark'), N('/tools/v2/dewatermark')] },
  { path: '/api/tools/enhancer', backups: [{ path: N('/tools/enhancer'), query: { url: 'url', resolusi: { value: '4' } } }, { path: N('/tools/v2/enhancer'), query: { url: 'url', type: { value: 'fast' } } }] },
  { path: '/api/tools/youtube-summarize', backups: ['/api/tools/youtube-summarize-v2'] }
];
