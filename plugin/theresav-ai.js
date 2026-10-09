// AI endpoints served through api.theresav.eu (see lib/theresav.js). Needs THERESAV_API_KEY.
const { makeEndpoint } = require('../lib/theresav');

const chatId = { name: 'chatId', placeholder: 'Opsional — isi chatId dari jawaban sebelumnya untuk lanjut ngobrol' };

const VOICES = ['Morgan Freeman', 'Elon Musk', 'Donald Trump', 'Barack Obama', 'Joe Biden', 'Taylor Swift', 'Billie Eilish', 'Eminem', 'Snoop Dogg', 'Kanye West', 'Drake', 'Ariana Grande', 'Cristiano Ronaldo', 'Lionel Messi', 'MrBeast', 'IShowSpeed', 'PewDiePie', 'Rick Sanchez', 'SpongeBob SquarePants', 'Patrick Star', 'Squidward Tentacles', 'Peter Griffin', 'Homer Simpson', 'Bart Simpson', 'Darth Vader', 'Yoda', 'Goku', 'Vegeta', 'Naruto Uzumaki', 'Luffy (One Piece)', 'Walter White', 'Tommy Shelby', 'David Attenborough', 'Samuel L. Jackson', 'Ryan Reynolds', 'Keanu Reeves', 'Scarlett Johansson', 'Cillian Murphy', 'Robert Downey Jr.', 'Leonardo DiCaprio', 'Johnny Depp', 'Mark Zuckerberg', 'Sam Altman', 'Steve Jobs', 'Bill Gates', 'Gordon Ramsay', 'Optimus Prime', 'Batman (Animated)', 'The Joker (Animated)', 'Deadpool', 'Kendrick Lamar', 'Dua Lipa', 'Justin Bieber', 'Katy Perry', 'Kobe Bryant', 'Michael Jackson', 'Freddie Mercury'];
const GENRES = ['fantasy', 'scifi', 'horror', 'romance', 'mystery', 'adventure', 'thriller'];

// Sample inputs the developer-panel self-test sends to the upstream (text only, so a failure
// means the endpoint is down, not a bad input).
const AI_SAMPLES = {
  '/api/ai/bible': { text: 'Siapa Musa?' },
  '/api/ai/bypassai': { text: 'This is a sample sentence to rewrite.' },
  '/api/ai/chatgpt': { prompt: 'hi' },
  '/api/ai/claude': { text: 'hi' },
  '/api/ai/copilot': { prompt: 'hi', mode: 'default' },
  '/api/ai/gemini': { prompt: 'hi' },
  '/api/ai/google': { query: 'ikan' },
  '/api/ai/gpt': { text: 'hi' },
  '/api/ai/voice': { prompt: 'halo', voice: 'Morgan Freeman' },
  '/api/ai/muslimai': { query: 'apa itu puasa' },
  '/api/ai/publicai': { text: 'hi' },
  '/api/ai/qwen': { text: 'hi' },
  '/api/ai/talefy': { text: 'kucing ajaib', genre: 'fantasy' },
  '/api/ai/turboseek': { text: 'what is an ini file' },
  '/api/ai/unlimited': { text: 'hi' },
  '/api/ai/webpilot': { text: 'berita hari ini' }
};

module.exports = [
  { name: 'Bible AI', desc: 'Find Bible-based answers using Bible AI.', path: '/api/ai/bible', upstream: '/api/ai/bible',
    params: [{ name: 'text', required: true, aliases: ['question'], placeholder: 'Siapa itu Musa?' }] },
  { name: 'Bypass AI', desc: 'Rewrite text to bypass AI detection.', path: '/api/ai/bypassai', upstream: '/api/ai/bypassai',
    params: [{ name: 'text', required: true, max: 8000, placeholder: 'Teks yang mau diubah' }] },
  { name: 'ChatGPT', desc: 'Chat with OpenAI ChatGPT for free without login.', path: '/api/ai/chatgpt', upstream: '/api/ai/chatgpt',
    params: [{ name: 'prompt', required: true, aliases: ['text'], placeholder: 'Halo, apa kabar?' }, chatId] },
  { name: 'Claude AI', desc: 'Chat with Claude Haiku 4.5 via Overchat API.', path: '/api/ai/claude', upstream: '/api/ai/claude',
    params: [{ name: 'text', required: true, aliases: ['prompt'], placeholder: 'Halo Claude' }] },
  { name: 'Copilot AI', desc: 'Chat with Microsoft Copilot AI, supports Web Search, Study Mode, Conversation, and Vision.', path: '/api/ai/copilot', upstream: '/api/ai/copilot',
    params: [{ name: 'prompt', required: true, aliases: ['text'], placeholder: 'Jelaskan fotosintesis' }, { name: 'mode', options: ['default', 'search', 'study'], default: 'default' },
      { name: 'conversationId', placeholder: 'Opsional — dari jawaban sebelumnya' }, { name: 'imageUrl', type: 'url', placeholder: 'Opsional — URL gambar https' }] },
  { name: 'Gemini', desc: 'Chat with Google Gemini AI for free without login.', path: '/api/ai/gemini', upstream: '/api/ai/gemini',
    params: [{ name: 'prompt', required: true, aliases: ['text'], placeholder: 'Halo Gemini' }, chatId] },
  { name: 'Google AI Search', desc: 'Performs a Google search using its AI mode (Gemini Bard Frontend) to get a comprehensive answer.', path: '/api/ai/google', upstream: '/api/ai/google',
    params: [{ name: 'query', required: true, aliases: ['q', 'text'], placeholder: 'Jenis-jenis ikan air tawar' }] },
  { name: 'GPT-4o', desc: 'Chat with GPT-4o Mini supporting text and image input with Dragonfly session cache.', path: '/api/ai/gpt', upstream: '/api/ai/gpt', multipart: true,
    file: { param: 'imageUrl', field: 'image' },
    params: [{ name: 'text', required: true, aliases: ['prompt'], placeholder: 'Jelaskan gambar ini' }, { name: 'imageUrl', type: 'url', placeholder: 'Opsional — URL gambar https' }, chatId] },
  { name: 'Magic Hour AI Voice', desc: 'Generate realistic speech and celebrity/character voices from text prompt using Magic Hour AI.', path: '/api/ai/voice', upstream: '/api/ai/magichour/voice',
    params: [{ name: 'prompt', required: true, aliases: ['text'], max: 1000, placeholder: 'Teks yang mau diucapkan' }, { name: 'voice', required: true, options: VOICES, placeholder: 'Morgan Freeman, Elon Musk, Goku, …' }] },
  { name: 'Muslim AI', desc: 'Quran-based Q&A using MuslimAI with Dragonfly session support.', path: '/api/ai/muslimai', upstream: '/api/ai/muslimai',
    params: [{ name: 'query', required: true, aliases: ['q', 'text'], placeholder: 'Apa hukum puasa sunnah?' }, chatId] },
  { name: 'Public AI', desc: 'Chat with Public AI with Dragonfly session support.', path: '/api/ai/publicai', upstream: '/api/ai/publicai',
    params: [{ name: 'text', required: true, aliases: ['prompt'], placeholder: 'Halo' }, chatId] },
  { name: 'Qwen AI', desc: 'AI Assistant by Alibaba Cloud (Qwen) with universal support for Text and any File format (Image, Audio, Video, PDF, Documents) with Dragonfly session cache.', path: '/api/ai/qwen', upstream: '/api/ai/qwen', multipart: true,
    file: { param: 'fileUrl', field: 'file', accept: '*' },
    params: [{ name: 'text', required: true, aliases: ['prompt'], placeholder: 'Ringkas dokumen ini' }, { name: 'fileUrl', type: 'url', placeholder: 'Opsional — URL file https' }, chatId,
      { name: 'search', type: 'bool', options: ['true', 'false'] }, { name: 'think', type: 'bool', options: ['true', 'false'] }] },
  { name: 'Talefy AI Story', desc: 'Generate AI stories based on prompt and genre using Talefy AI.', path: '/api/ai/talefy', upstream: '/api/ai/talefy',
    params: [{ name: 'text', required: true, aliases: ['prompt'], placeholder: 'Kucing yang bisa terbang' }, { name: 'genre', required: true, options: GENRES }] },
  { name: 'TurboSeek AI', desc: 'Searches for an answer using TurboSeek AI.', path: '/api/ai/turboseek', upstream: '/api/ai/turboseek',
    params: [{ name: 'text', required: true, aliases: ['query', 'q'], placeholder: 'Apa itu file INI?' }] },
  { name: 'Unlimited AI', desc: 'AI Chat with reasoning model from unlimitedai.chat with Dragonfly session support.', path: '/api/ai/unlimited', upstream: '/api/ai/unlimited',
    params: [{ name: 'text', required: true, aliases: ['prompt'], placeholder: 'Halo' }, chatId] },
  { name: 'WebPilot AI', desc: 'Web-searching AI assistant via Webpilot API with Dragonfly session support.', path: '/api/ai/webpilot', upstream: '/api/ai/webpilot',
    params: [{ name: 'text', required: true, aliases: ['query', 'q'], placeholder: 'Berita teknologi hari ini' }, { name: 'threadId', placeholder: 'Opsional — dari jawaban sebelumnya' }] }
].map(s => makeEndpoint({ ...s, sample: AI_SAMPLES[s.path] }));
