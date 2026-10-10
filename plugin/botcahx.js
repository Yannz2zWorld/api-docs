'use strict';
// Endpoints from BOTCAHX (https://api.botcahx.eu.org), proxied through lib/apiproxy.js. The key is
// BOTCAHX_API_KEY in Vercel (config/apiServers.js), never in the repo.
//
// Every path here was tried against the live API before it went in (the docs page needs a login).
// Endpoints that do what the site already has are backupOnly under /api/alt2/...: not listed on their
// own, the site switches to them when the main one breaks (config/endpointGroups.js). Nothing a
// caller sees names the upstream. `rename` keeps our usual parameter names (q, text, url) where
// BOTCAHX calls them differently.
//
// Left out on purpose:
//   - /api/search/xvideos: konten dewasa.
//   - /api/dowloader/igdowloader, /api/dowloader/twitter, /api/dowloader/threads,
//     /api/dowloader/pinterest, /api/dowloader/sfilemobi, /api/dowloader/likee,
//     /api/dowloader/cocofun, /api/search/happymod, /api/search/googleimage,
//     /api/search/tiktoks, /api/news/tribun: nggak ngasih hasil waktu dicoba.
//   - /api/dowloader/spotify, /api/dowloader/douyin, /api/stalk/yt, /api/islamic/asmaulhusna:
//     kelamaan (lebih dari 45 detik) waktu dicoba.
//   - /api/primbon/zodiak, /api/primbon/kecocokanpasangan: parameternya nggak jelas, udah ada
//     versi lain di web.
const { makeEndpoint } = require('../lib/apiproxy');
const { checkSampleImage } = require('../lib/theresav');
// Sample photo for the automatic endpoint check (the real request uses the caller's own image).
const IMG = checkSampleImage();
const B = path => '/api/alt2' + path;
const S = (category, name, desc, path, upstream, params = [], extra = {}) => ({ server: 'botcahx', category, name, desc, path, upstream, params, ...extra });
const q = (placeholder, name = 'q') => [{ name, required: true, placeholder }];

const SPECS = [
  // ---------------------------------------------------------------- Islamic
  S('Islamic', 'Ayat Kursi', 'Ayat Kursi lengkap: arab, latin, arti, sama tafsirnya.', '/api/islamic/ayatkursi', '/api/islamic/ayatkursi'),
  S('Islamic', 'Bacaan Shalat', 'Bacaan shalat dari iftitah sampai salam: arab, latin, arti.', '/api/islamic/bacaanshalat', '/api/islamic/bacaanshalat'),
  S('Islamic', 'Doa Harian', 'Kumpulan doa sehari-hari: arab, latin, arti.', '/api/islamic/doaharian', '/api/islamic/doaharian'),
  S('Islamic', 'Kisah Nabi', 'Kisah 25 nabi: kelahiran, usia wafat, tempat, dan ceritanya.', '/api/islamic/kisahnabi', '/api/islamic/kisahnabi', q('adam', 'nabi'), { sample: { nabi: 'adam' } }),
  S('Islamic', 'Surah Al-Qur\'an', 'Ayat-ayat satu surah: arab, latin, arti. Nomor surah 1–114.', '/api/islamic/surah', '/api/islamic/surah', q('1', 'no'), { sample: { no: '1' } }),
  S('Islamic', 'Tahlil', 'Susunan bacaan tahlil lengkap sama artinya.', '/api/islamic/tahlil', '/api/islamic/tahlil'),
  S('Islamic', 'Wirid', 'Bacaan wirid sesudah shalat lima waktu.', '/api/islamic/wirid', '/api/islamic/wirid'),

  // ---------------------------------------------------------------- News
  S('News', 'Detik News', 'Berita terbaru dari detik.com.', '/api/news/detik', '/api/news/detik'),
  S('News', 'Okezone News', 'Berita terbaru dari okezone.com.', '/api/news/okezone', '/api/news/okezone'),

  // ---------------------------------------------------------------- Games / Random
  S('Games', 'Teka-Teki', 'Teka-teki acak plus jawabannya.', '/api/games/tekateki', '/api/game/tekateki'),
  S('Random', 'Truth', 'Pertanyaan truth acak buat main truth or dare.', '/api/random/truth', '/api/random/truth'),
  S('Random', 'Dare', 'Tantangan dare acak buat main truth or dare.', '/api/random/dare', '/api/random/dare'),
  S('Random', 'Meme Random', 'Gambar meme acak.', '/api/random/meme', '/api/random/meme'),

  // ---------------------------------------------------------------- AI / Search
  S('AI', 'Blackbox AI', 'Ngobrol sama Blackbox AI, jago soal coding.', '/api/ai/blackbox', '/api/search/blackbox-chat', q('cara bikin server express', 'text'), { sample: { text: 'halo' } }),
  S('AI', 'AI Image Generator', 'Bikin gambar dari teks pakai AI.', '/api/ai/image-gen', '/api/search/openai-image', q('kucing astronot di bulan', 'text'), { sample: { text: 'kucing lucu' } }),
  S('Search', 'Google Search', 'Cari di web: judul, link, sama cuplikannya.', '/api/search/google', '/api/search/google', q('nodejs express'), { rename: { q: 'text1' }, sample: { q: 'nodejs' } }),
  S('Search', 'Resep Masakan', 'Cari resep masakan: bahan, langkah, dan fotonya.', '/api/search/resep', '/api/search/resep', q('nasi goreng'), { rename: { q: 'query' }, sample: { q: 'nasi goreng' } }),

  // ---------------------------------------------------------------- Maker / Tools / Stalk / Downloader
  S('Maker', 'ATTP', 'Teks animasi warna-warni (GIF), cocok buat stiker.', '/api/maker/attp', '/api/maker/attp', q('halo', 'text'), { sample: { text: 'halo' } }),
  S('Maker', 'TTP', 'Teks jadi gambar (PNG), cocok buat stiker.', '/api/maker/ttp', '/api/maker/ttp', q('halo', 'text'), { sample: { text: 'halo' } }),
  S('Tools', 'TinyURL', 'Pendekin link pakai TinyURL.', '/api/tools/tinyurl', '/api/tools/tinyurl', q('https://example.com', 'url'), { rename: { url: 'link' }, sample: { url: 'https://example.com' } }),
  S('Stalk', 'Free Fire Stalk', 'Cek nickname akun Free Fire dari ID.', '/api/stalk/freefire', '/api/stalk/ff', q('ID akun Free Fire', 'id'), { sample: { id: '1234567' } }),
  S('Downloader', 'SnackVideo Downloader', 'Download video SnackVideo tanpa watermark.', '/api/download/snackvideo', '/api/dowloader/snackvideo', q('https://s.snackvideo.com/p/...', 'url'), { sample: { url: 'https://s.snackvideo.com/p/j9jKr9dR' } }),

  // ---------------------------------------------------------------- Cadangan (backupOnly)
  S('Downloader', 'TikTok Downloader (cadangan)', 'Download video TikTok.', B('/download/tiktok'), '/api/dowloader/tiktok', q('URL TikTok', 'url'), { backupOnly: true, sample: { url: 'https://www.tiktok.com/@tiktok/video/7106594312292453675' } }),
  S('Downloader', 'YouTube Downloader (cadangan)', 'Download video/audio YouTube.', B('/download/youtube'), '/api/dowloader/yt', q('URL YouTube', 'url'), { backupOnly: true, sample: { url: 'https://youtu.be/dQw4w9WgXcQ' } }),
  S('Downloader', 'CapCut Downloader (cadangan)', 'Download template CapCut.', B('/download/capcut'), '/api/dowloader/capcut', q('URL CapCut', 'url'), { backupOnly: true, sample: { url: 'https://www.capcut.com/template-detail/7299286607478181121' } }),
  S('Downloader', 'Facebook Downloader (cadangan)', 'Download video Facebook.', B('/download/facebook'), '/api/dowloader/fbdown', q('URL Facebook', 'url'), { backupOnly: true, sample: { url: 'https://www.facebook.com/watch/?v=1393572814172251' } }),
  S('Downloader', 'Google Drive Downloader (cadangan)', 'Direct link file publik Google Drive.', B('/download/gdrive'), '/api/dowloader/gdrive', q('URL Drive', 'url'), { backupOnly: true, sample: { url: 'https://drive.google.com/file/d/1thDYWcS5p5FFhzTpTev7RUv0VFnNQyZ4/view' } }),
  S('Downloader', 'SoundCloud Downloader (cadangan)', 'Download lagu SoundCloud.', B('/download/soundcloud'), '/api/dowloader/soundcloud', q('URL SoundCloud', 'url'), { backupOnly: true, sample: { url: 'https://soundcloud.com/issabella-marchelina/sisa-rasa-mahalini-official-audio' } }),
  S('AI', 'ChatGPT (cadangan)', 'Ngobrol sama AI.', B('/ai/openai-chat'), '/api/search/openai-chat', q('halo', 'text'), { backupOnly: true, sample: { text: 'halo' } }),
  S('AI', 'GPT (cadangan)', 'Ngobrol sama AI.', B('/ai/gpt'), '/api/search/gpt', q('halo', 'text'), { backupOnly: true, sample: { text: 'halo' } }),
  S('AI', 'Bard (cadangan)', 'Ngobrol sama AI.', B('/ai/bard'), '/api/search/bard-ai', q('halo', 'text'), { backupOnly: true, sample: { text: 'halo' } }),
  S('Maker', 'Brat (cadangan)', 'Gambar teks gaya brat.', B('/maker/brat'), '/api/maker/brat', q('halo', 'text'), { backupOnly: true, sample: { text: 'halo' } }),
  S('Maker', 'Brat Video (cadangan)', 'Video teks gaya brat.', B('/maker/bratvid'), '/api/maker/brat-video', q('halo', 'text'), { backupOnly: true, sample: { text: 'halo' } }),
  S('Maker', 'Carbon (cadangan)', 'Gambar kode gaya Carbon.', B('/maker/carbon'), '/api/maker/carbon', q('console.log(1)', 'text'), { backupOnly: true, sample: { text: 'console.log(1)' } }),
  S('Maker', 'iPhone Quote Chat (cadangan)', 'Gambar bubble chat iPhone.', B('/maker/iqc'), '/api/maker/iqc', q('halo', 'text'), { backupOnly: true, sample: { text: 'halo' } }),
  S('Tools', 'Remini (cadangan)', 'Perjelas gambar pakai AI.', B('/tools/remini'), '/api/tools/remini', q('URL gambar', 'url'), { backupOnly: true, sample: { url: IMG } }),
  S('Tools', 'Remove Background (cadangan)', 'Hapus background gambar.', B('/tools/removebg'), '/api/tools/removebg', q('URL gambar', 'url'), { backupOnly: true, sample: { url: IMG } }),
  S('Tools', 'Website Screenshot (cadangan)', 'Screenshot website.', B('/tools/ssweb'), '/api/tools/ssweb', [{ name: 'url', required: true }, { name: 'device', required: false }], { backupOnly: true, sample: { url: 'https://example.com', device: 'desktop' } }),
  S('Tools', 'Translate (cadangan)', 'Terjemahin teks.', B('/tools/translate'), '/api/tools/translate', [{ name: 'text', required: true }, { name: 'lang', required: false }], { backupOnly: true, sample: { text: 'selamat pagi', lang: 'en' } }),
  S('Info', 'Cuaca (cadangan)', 'Cuaca sekarang di satu kota.', B('/info/cuaca'), '/api/tools/cuaca', q('jakarta', 'query'), { backupOnly: true, sample: { query: 'jakarta' } }),
  S('Search', 'Pinterest Search (cadangan)', 'Cari gambar Pinterest.', B('/search/pinterest'), '/api/search/pinterest', q('kucing', 'text1'), { backupOnly: true, sample: { text1: 'kucing' } }),
  S('Search', 'YouTube Search (cadangan)', 'Cari video YouTube.', B('/search/youtube'), '/api/search/yts', q('lofi', 'query'), { backupOnly: true, sample: { query: 'lofi' } }),
  S('Search', 'Spotify Search (cadangan)', 'Cari lagu Spotify.', B('/search/spotify'), '/api/search/spotify', q('yellow', 'query'), { backupOnly: true, sample: { query: 'yellow' } }),
  S('Search', 'Wikipedia (cadangan)', 'Cari artikel Wikipedia.', B('/search/wikipedia'), '/api/search/wikipedia', q('indonesia', 'text'), { backupOnly: true, sample: { text: 'indonesia' } }),
  S('Search', 'KBBI (cadangan)', 'Cari arti kata di KBBI.', B('/search/kbbi'), '/api/search/kbbi', q('makan', 'text'), { backupOnly: true, sample: { text: 'makan' } }),
  S('Search', 'Lirik Lagu (cadangan)', 'Cari lirik lagu.', B('/search/lirik'), '/api/search/lirik', q('yellow coldplay', 'lirik'), { backupOnly: true, sample: { lirik: 'yellow coldplay' } }),
  S('Stalk', 'Instagram Stalk (cadangan)', 'Info profil Instagram.', B('/stalk/instagram'), '/api/stalk/ig', q('instagram', 'username'), { backupOnly: true, sample: { username: 'instagram' } }),
  S('Stalk', 'TikTok Stalk (cadangan)', 'Info profil TikTok.', B('/stalk/tiktok'), '/api/stalk/tt', q('tiktok', 'username'), { backupOnly: true, sample: { username: 'tiktok' } }),
  S('Stalk', 'Twitter Stalk (cadangan)', 'Info profil X/Twitter.', B('/stalk/twitter'), '/api/stalk/twitter', q('elonmusk', 'username'), { backupOnly: true, sample: { username: 'elonmusk' } }),
  S('Stalk', 'Genshin Stalk (cadangan)', 'Info akun Genshin Impact.', B('/stalk/genshin'), '/api/stalk/genshin', q('800000000', 'id'), { backupOnly: true, sample: { id: '800000000' } }),
  S('Stalk', 'Roblox Stalk (cadangan)', 'Info akun Roblox.', B('/stalk/roblox'), '/api/stalk/roblox', q('builderman', 'username'), { backupOnly: true, sample: { username: 'builderman' } }),
  S('Check', 'Cek Akun MLBB (cadangan)', 'Cek nickname akun Mobile Legends.', B('/check/mlbb'), '/api/stalk/ml', [{ name: 'id', required: true }, { name: 'server', required: true }], { backupOnly: true, sample: { id: '1422073161', server: '15910' } }),
  S('Primbon', 'Arti Nama (cadangan)', 'Arti nama menurut primbon.', B('/primbon/artinama'), '/api/primbon/artinama', q('budi', 'nama'), { backupOnly: true, sample: { nama: 'budi' } }),
  S('News', 'CNN News (cadangan)', 'Berita terbaru CNN Indonesia.', B('/news/cnn'), '/api/news/cnn', [], { backupOnly: true }),
  S('News', 'CNBC News (cadangan)', 'Berita terbaru CNBC Indonesia.', B('/news/cnbc'), '/api/news/cnbc', [], { backupOnly: true }),
  S('News', 'Kompas News (cadangan)', 'Berita terbaru Kompas.', B('/news/kompas'), '/api/news/kompas', [], { backupOnly: true }),
  S('Random', 'Kata Motivasi (cadangan)', 'Kata motivasi acak.', B('/random/motivasi'), '/api/random/motivasi', [], { backupOnly: true }),
  S('Random', 'Anime Quote (cadangan)', 'Quote anime acak.', B('/random/quotesanime'), '/api/random/quotesanime', [], { backupOnly: true }),
  ...[['asahotak', 'asahotak', 'Asah Otak'], ['family100', 'family100', 'Family 100'], ['siapa-dia', 'siapakahaku', 'Siapakah Aku'], ['susunkata', 'susunkata', 'Susun Kata'],
    ['tebakbendera', 'tebakbendera', 'Tebak Bendera'], ['tebakgambar', 'tebakgambar', 'Tebak Gambar'], ['tebak-kabupaten', 'tebakkabupaten', 'Tebak Kabupaten'], ['tebakkata', 'tebakkata', 'Tebak Kata'],
    ['tebak-kimia', 'tebakkimia', 'Tebak Kimia'], ['tebak-lagu', 'tebaklagu', 'Tebak Lagu'], ['tebak-lirik', 'tebaklirik', 'Tebak Lirik'], ['tebak-tebakan', 'tebaktebakan', 'Tebak-tebakan']]
    .map(([ours, theirs, name]) => S('Games', `${name} (cadangan)`, `Kuis ${name.toLowerCase()} acak.`, B('/games/' + ours), '/api/game/' + theirs, [], { backupOnly: true }))
];

module.exports = SPECS.map(makeEndpoint);
