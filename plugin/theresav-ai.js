// AI endpoints served through api.theresav.eu (see lib/theresav.js). Needs THERESAV_API_KEY.
const { makeEndpoint } = require('../lib/theresav');

const chatId = { name: 'chatId', placeholder: 'Opsional — isi chatId dari jawaban sebelumnya untuk lanjut ngobrol' };

const VOICES = ['Morgan Freeman', 'Elon Musk', 'Donald Trump', 'Barack Obama', 'Joe Biden', 'Taylor Swift', 'Billie Eilish', 'Eminem', 'Snoop Dogg', 'Kanye West', 'Drake', 'Ariana Grande', 'Cristiano Ronaldo', 'Lionel Messi', 'MrBeast', 'IShowSpeed', 'PewDiePie', 'Rick Sanchez', 'SpongeBob SquarePants', 'Patrick Star', 'Squidward Tentacles', 'Peter Griffin', 'Homer Simpson', 'Bart Simpson', 'Darth Vader', 'Yoda', 'Goku', 'Vegeta', 'Naruto Uzumaki', 'Luffy (One Piece)', 'Walter White', 'Tommy Shelby', 'David Attenborough', 'Samuel L. Jackson', 'Ryan Reynolds', 'Keanu Reeves', 'Scarlett Johansson', 'Cillian Murphy', 'Robert Downey Jr.', 'Leonardo DiCaprio', 'Johnny Depp', 'Mark Zuckerberg', 'Sam Altman', 'Steve Jobs', 'Bill Gates', 'Gordon Ramsay', 'Optimus Prime', 'Batman (Animated)', 'The Joker (Animated)', 'Deadpool', 'Kendrick Lamar', 'Dua Lipa', 'Justin Bieber', 'Katy Perry', 'Kobe Bryant', 'Michael Jackson', 'Freddie Mercury'];
const GENRES = ['fantasy', 'scifi', 'horror', 'romance', 'mystery', 'adventure', 'thriller'];

module.exports = [
  { name: 'Bible AI', desc: 'Tanya jawab seputar Alkitab, lengkap dengan sumber ayat dan artikel.', path: '/api/ai/bible', upstream: '/api/ai/bible',
    params: [{ name: 'text', required: true, aliases: ['question'], placeholder: 'Siapa itu Musa?' }] },
  { name: 'Bypass AI', desc: 'Ubah teks hasil AI supaya terdengar lebih natural (humanizer).', path: '/api/ai/bypassai', upstream: '/api/ai/bypassai',
    params: [{ name: 'text', required: true, max: 8000, placeholder: 'Teks yang mau diubah' }] },
  { name: 'ChatGPT', desc: 'Ngobrol dengan ChatGPT. Kirim chatId dari jawaban sebelumnya untuk lanjut percakapan.', path: '/api/ai/chatgpt', upstream: '/api/ai/chatgpt',
    params: [{ name: 'prompt', required: true, aliases: ['text'], placeholder: 'Halo, apa kabar?' }, chatId] },
  { name: 'Claude AI', desc: 'Ngobrol dengan Claude AI.', path: '/api/ai/claude', upstream: '/api/ai/claude',
    params: [{ name: 'text', required: true, aliases: ['prompt'], placeholder: 'Halo Claude' }] },
  { name: 'Copilot AI', desc: 'Microsoft Copilot dengan mode search / study / default, bisa lanjut percakapan dan baca gambar.', path: '/api/ai/copilot', upstream: '/api/ai/copilot',
    params: [{ name: 'prompt', required: true, aliases: ['text'], placeholder: 'Jelaskan fotosintesis' }, { name: 'mode', options: ['default', 'search', 'study'], default: 'default' },
      { name: 'conversationId', placeholder: 'Opsional — dari jawaban sebelumnya' }, { name: 'imageUrl', type: 'url', placeholder: 'Opsional — URL gambar https' }] },
  { name: 'Gemini', desc: 'Ngobrol dengan Google Gemini. Kirim chatId untuk lanjut percakapan.', path: '/api/ai/gemini', upstream: '/api/ai/gemini',
    params: [{ name: 'prompt', required: true, aliases: ['text'], placeholder: 'Halo Gemini' }, chatId] },
  { name: 'Google AI Search', desc: 'Jawaban ringkas ala Google AI Overview untuk sebuah pencarian.', path: '/api/ai/google', upstream: '/api/ai/google',
    params: [{ name: 'query', required: true, aliases: ['q', 'text'], placeholder: 'Jenis-jenis ikan air tawar' }] },
  { name: 'GPT-4o (bisa baca gambar)', desc: 'GPT-4o: kirim teks, opsional URL gambar untuk dianalisis. Kirim chatId untuk lanjut percakapan.', path: '/api/ai/gpt', upstream: '/api/ai/gpt', multipart: true,
    file: { param: 'imageUrl', field: 'image' },
    params: [{ name: 'text', required: true, aliases: ['prompt'], placeholder: 'Jelaskan gambar ini' }, { name: 'imageUrl', type: 'url', placeholder: 'Opsional — URL gambar https' }, chatId] },
  { name: 'AI Voice Generator', desc: 'Ubah teks jadi suara tokoh terkenal (Magic Hour).', path: '/api/ai/voice', upstream: '/api/ai/magichour/voice',
    params: [{ name: 'prompt', required: true, aliases: ['text'], max: 1000, placeholder: 'Teks yang mau diucapkan' }, { name: 'voice', required: true, options: VOICES, placeholder: 'Morgan Freeman, Elon Musk, Goku, …' }] },
  { name: 'Muslim AI', desc: 'Tanya jawab seputar Islam berdasarkan Al-Qur\'an. Kirim chatId untuk lanjut percakapan.', path: '/api/ai/muslimai', upstream: '/api/ai/muslimai',
    params: [{ name: 'query', required: true, aliases: ['q', 'text'], placeholder: 'Apa hukum puasa sunnah?' }, chatId] },
  { name: 'Public AI', desc: 'Chat AI umum. Kirim chatId untuk lanjut percakapan.', path: '/api/ai/publicai', upstream: '/api/ai/publicai',
    params: [{ name: 'text', required: true, aliases: ['prompt'], placeholder: 'Halo' }, chatId] },
  { name: 'Qwen AI (teks & file)', desc: 'Qwen dari Alibaba Cloud: teks plus file opsional (gambar, audio, video, PDF, dokumen) lewat URL, mode search dan think.', path: '/api/ai/qwen', upstream: '/api/ai/qwen', multipart: true,
    file: { param: 'fileUrl', field: 'file' },
    params: [{ name: 'text', required: true, aliases: ['prompt'], placeholder: 'Ringkas dokumen ini' }, { name: 'fileUrl', type: 'url', placeholder: 'Opsional — URL file https' }, chatId,
      { name: 'search', type: 'bool', placeholder: 'true / false' }, { name: 'think', type: 'bool', placeholder: 'true / false' }] },
  { name: 'Talefy AI Story', desc: 'Buat cerita pendek dari ide dan genre.', path: '/api/ai/talefy', upstream: '/api/ai/talefy',
    params: [{ name: 'text', required: true, aliases: ['prompt'], placeholder: 'Kucing yang bisa terbang' }, { name: 'genre', required: true, options: GENRES }] },
  { name: 'TurboSeek AI', desc: 'Cari jawaban dari web lengkap dengan daftar sumber.', path: '/api/ai/turboseek', upstream: '/api/ai/turboseek',
    params: [{ name: 'text', required: true, aliases: ['query', 'q'], placeholder: 'Apa itu file INI?' }] },
  { name: 'Unlimited AI', desc: 'Chat AI dengan model reasoning. Kirim chatId untuk lanjut percakapan.', path: '/api/ai/unlimited', upstream: '/api/ai/unlimited',
    params: [{ name: 'text', required: true, aliases: ['prompt'], placeholder: 'Halo' }, chatId] },
  { name: 'WebPilot AI', desc: 'Asisten AI yang mencari di web. Kirim threadId untuk lanjut percakapan.', path: '/api/ai/webpilot', upstream: '/api/ai/webpilot',
    params: [{ name: 'text', required: true, aliases: ['query', 'q'], placeholder: 'Berita teknologi hari ini' }, { name: 'threadId', placeholder: 'Opsional — dari jawaban sebelumnya' }] }
].map(makeEndpoint);
