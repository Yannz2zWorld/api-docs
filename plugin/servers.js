// Endpoint yang di-proxy ke server pihak ketiga (clutch & termai) lewat lib/apiproxy.js.
// Server + key diatur di config/apiServers.js (key dibaca dari ENV di Vercel, tidak pernah di repo).
// Path & parameter diambil dari pemakaian asli di bot (global.apialip / global.termai).
//
// Endpoint foto memakai `fileUrl`: user mengunggah gambar -> disimpan di CDN kita -> URL-nya
// dikirim ke server (karena server itu hanya menerima parameter `url`, bukan unggahan).
//
// SENGAJA TIDAK dibuat (alasan keamanan/etika):
//   - clutch /imagecreator/deepnude  dan  pitucode /deep-nude-ai-undress  -> gambar telanjang
//     non-konsensual.
//   - clutch /imagecreator/fakeff    -> keluarga "fake" (akun palsu).
//   - clutch /tools/osin             -> lookup identitas dari nomor HP (potensi doxxing).
//   - clutch /imagecreator/iqc, termai /api/chat/logic-bell, termai voice-covers -> bentuk
//     parameter tidak jelas dari sumber; dilewati agar tidak jadi endpoint error.
//   - dongtube & pitucode -> tidak ada endpoint aman yang terpakai.
const { makeEndpoint } = require('../lib/apiproxy');
const { checkSampleImage } = require('../lib/theresav');
// Sample photo for the automatic endpoint check (the real request uses the user's own photo).
const IMG = checkSampleImage();

const text = (name, extra = []) => [{ name, required: true }, ...extra];

// Endpoint yang fiturnya SUDAH disediakan theresav (gemini, publicai, webpilot, aio, facebook,
// instagram, spotify, tiktok, ytmp3, brat, bratvid) sengaja tidak diduplikasi dari clutch —
// hanya endpoint unik clutch yang dipasang di bawah.
const SPECS = [
  // ---------------------------------------------------------------- Clutch · AI
  { server: 'clutch', category: 'AI', name: 'HyperAI', desc: 'Chat AI serbaguna (HyperAI).', path: '/api/ai/hyperai', upstream: '/ai/hyperai', params: text('prompt'), sample: { prompt: 'Jelaskan fotosintesis singkat.' } },
  { server: 'clutch', category: 'AI', name: 'PowerBrain', desc: 'Chat AI PowerBrain.', path: '/api/ai/powerbrain', upstream: '/ai/powerbrain', params: text('prompt'), sample: { prompt: 'Beri 3 ide nama toko kopi.' } },
  { server: 'clutch', category: 'AI', name: 'Venice', desc: 'Chat AI Venice.', path: '/api/ai/venice', upstream: '/ai/venice', params: text('prompt'), sample: { prompt: 'Tulis pantun tentang hujan.' } },
  { server: 'clutch', category: 'AI', name: 'Gemini Vision', desc: 'Gemini dengan gambar: kirim teks (+ unggah gambar opsional).', path: '/api/ai/gemini-vision', sample: { text: 'Apa isi gambar ini?', url: IMG }, upstream: '/ai/gemini-vision',
    fileUrl: { param: 'url', accept: 'image/*', required: false },
    params: [{ name: 'text', required: true, placeholder: 'Pertanyaan tentang gambar' }, { name: 'url', required: false }] },
  { server: 'clutch', category: 'AI', name: 'NSFW Check', desc: 'Deteksi apakah sebuah gambar NSFW (unggah atau URL).', path: '/api/ai/nsfw-check', sample: { url: IMG }, upstream: '/ai/nsfw-check',
    fileUrl: { param: 'url', accept: 'image/*', required: true }, params: [{ name: 'url', required: true }] },

  // ---------------------------------------------------------------- Clutch · Downloader
  { server: 'clutch', category: 'Downloader', name: 'YouTube Downloader', desc: 'Unduh video YouTube.', path: '/api/download/youtube', sample: { url: 'https://youtube.com/shorts/5fs0aY9jYes', type: 'video', quality: '360p' }, upstream: '/download/youtube',
    params: [{ name: 'url', required: true, type: 'url', placeholder: 'https://youtu.be/...' }, { name: 'type', required: false, default: 'video' }, { name: 'quality', required: false, default: '360p' }] },

  // ---------------------------------------------------------------- Clutch · Search
  { server: 'clutch', category: 'Search', name: 'NPM Search', desc: 'Cari paket di npm.', path: '/api/search/npm', upstream: '/search/npm', params: text('q'), sample: { q: 'express' } },
  { server: 'clutch', category: 'Search', name: 'Pinterest Search', desc: 'Cari gambar di Pinterest.', path: '/api/search/pinterest', upstream: '/search/pinterest', params: text('q'), sample: { q: 'aesthetic wallpaper' } },
  { server: 'clutch', category: 'Search', name: 'Spotify Lyrics', desc: 'Cari lirik lagu.', path: '/api/search/spotify-lirik', upstream: '/search/spotify-lirik', params: text('title'), sample: { title: 'coldplay yellow' } },
  { server: 'clutch', category: 'Search', name: 'TikTok Search', desc: 'Cari video TikTok.', path: '/api/search/tiktok', upstream: '/search/tiktok', params: text('q'), sample: { q: 'kucing lucu' } },
  { server: 'clutch', category: 'Search', name: 'YouTube Search', desc: 'Cari video YouTube.', path: '/api/search/youtube', upstream: '/search/youtube', params: text('q'), sample: { q: 'lofi hip hop' } },

  // ---------------------------------------------------------------- Clutch · Stalk
  { server: 'clutch', category: 'Stalk', name: 'GitHub Stalk', desc: 'Info profil GitHub publik.', path: '/api/stalk/github', upstream: '/stalk/github', params: text('username'), sample: { username: 'torvalds' } },
  { server: 'clutch', category: 'Stalk', name: 'Instagram Stalk', desc: 'Info profil Instagram publik.', path: '/api/stalk/instagram', upstream: '/stalk/instagram', params: text('username'), sample: { username: 'instagram' } },
  { server: 'clutch', category: 'Stalk', name: 'TikTok Stalk', desc: 'Info profil TikTok publik.', path: '/api/stalk/tiktok', upstream: '/stalk/tiktok', params: text('username'), sample: { username: 'tiktok' } },

  // ---------------------------------------------------------------- Clutch · Tools
  { server: 'clutch', category: 'Tools', name: 'OCR', desc: 'Baca teks dari gambar (unggah atau URL).', path: '/api/tools/ocr', sample: { url: IMG }, upstream: '/tools/ocr',
    fileUrl: { param: 'url', accept: 'image/*', required: true }, params: [{ name: 'url', required: true }] },
  { server: 'clutch', category: 'Tools', name: 'Text to Speech', desc: 'Ubah teks jadi suara.', path: '/api/tools/text-to-speech', upstream: '/tools/text-to-speech',
    params: [{ name: 'text', required: true, placeholder: 'Teks yang dibacakan' }, { name: 'voice', required: false, default: 'dylan', placeholder: 'dylan' }], sample: { text: 'Halo dunia', voice: 'dylan' } },
  { server: 'clutch', category: 'Tools', name: 'Emoji to GIF', desc: 'Ubah emoji jadi GIF animasi.', path: '/api/tools/emojitogif', upstream: '/tools/emojitogif', params: [{ name: 'emoji', required: true, placeholder: '😀' }], sample: { emoji: '😀' } },

  // ---------------------------------------------------------------- Clutch · Maker
  { server: 'clutch', category: 'Maker', name: 'Banana Generate', desc: 'Buat gambar dari teks (AI).', path: '/api/maker/bananagen', sample: { prompt: 'kucing lucu pakai topi' }, upstream: '/imagecreator/bananagen',
    params: [{ name: 'prompt', required: true, placeholder: 'kucing astronot cat air' }, { name: 'model', required: false, default: 'auto' }] },
  { server: 'clutch', category: 'Maker', name: 'Banana Edit', desc: 'Edit gambar dengan AI (unggah gambar + prompt).', path: '/api/maker/bananaai', sample: { url: IMG, prompt: 'jadikan gaya anime' }, upstream: '/imagecreator/bananaai',
    fileUrl: { param: 'url', accept: 'image/*', required: true }, params: [{ name: 'url', required: true }, { name: 'prompt', required: true, placeholder: 'jadikan gaya anime' }] },
  { server: 'clutch', category: 'Maker', name: 'Remini', desc: 'Perjelas / HD-kan foto (unggah atau URL).', path: '/api/maker/remini', sample: { url: IMG }, upstream: '/imagecreator/remini',
    fileUrl: { param: 'url', accept: 'image/*', required: true }, params: [{ name: 'url', required: true }] },
  { server: 'clutch', category: 'Maker', name: 'Quoted Chat', desc: 'Buat gambar "quoted" chat (nama + teks + foto opsional).', path: '/api/maker/quoted', sample: { username: 'Yannz', text: 'Halo semua' }, upstream: '/imagecreator/quoted',
    fileUrl: { param: 'profile', accept: 'image/*', required: false },
    params: [{ name: 'username', required: true, placeholder: 'Nama' }, { name: 'text', required: true, placeholder: 'Isi pesan' }, { name: 'profile', required: false }, { name: 'bg', required: false, placeholder: '#000000' }] },

  // ---------------------------------------------------------------- Termai
  { server: 'termai', category: 'AI', name: 'Bard Chat', desc: 'Chat AI Bard (Termai).', path: '/api/ai/bard', upstream: '/api/chat/bard', params: [{ name: 'query', required: true, aliases: ['prompt', 'text'], placeholder: 'Tanya apa saja' }], sample: { query: 'Halo' } },
  { server: 'termai', category: 'Downloader', name: 'TikTok (Termai)', desc: 'Unduh video TikTok via Termai.', path: '/api/download/tiktok-termai', sample: { url: 'https://vt.tiktok.com/ZSbpMHCBM/' }, upstream: '/api/downloader/tiktok', params: [{ name: 'url', required: true, type: 'url', placeholder: 'https://vt.tiktok.com/...' }] },
  { server: 'termai', category: 'Maker', name: 'Anime Diffusion', desc: 'Buat gambar anime dari teks.', path: '/api/maker/animediff', sample: { prompt: '1girl, smile, white hair' }, upstream: '/api/text2img/animediff', params: [{ name: 'prompt', required: true, placeholder: '1girl, white hair, kimono' }] }
];

module.exports = SPECS.map(makeEndpoint);
