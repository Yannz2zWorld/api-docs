'use strict';
// Command WhatsApp untuk SETIAP endpoint APIZ2Z yang terverifikasi di library/catalog/apiz2z-endpoints.json
// (dibuat dari source platform apiz2z.web.id oleh tools/sync-apiz2z-catalog.js). Tidak ada endpoint karangan:
// endpoint yang tidak ada di katalog tidak bisa dipanggil (library/apiz2z.js menolak).
//
// Input pengguna -> parameter endpoint:
//   - key=value untuk parameter mana pun (mis. .ytmp3 https://... bitrate=320k)
//   - sisa teks mengisi parameter wajib yang belum terisi; >1 parameter wajib dipisah "|"
//   - parameter file (upload): kirim/reply gambar/media -> di-upload sebagai body POST
//   - avatar/username/guildName/memberCount otomatis diisi dari profil & grup kalau kosong
// Respons dirender sesuai bentuk aslinya (library/apiz2z-render.js).

const { loadCatalog } = require('../../library/apiz2z');
const { render } = require('../../library/apiz2z-render');
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

// Nama command untuk endpoint populer (mengikuti nama command Yann AI V15 / base).
const NAMES = {
  '/api/download/tiktok': ['tiktok', ['tt', 'ttdl', 'tiktokdl']], '/api/download/instagram': ['instagram', ['ig', 'igdl']],
  '/api/download/facebook': ['facebook', ['fb', 'fbdl']], '/api/download/twitter': ['twitter', ['twdl', 'xdl']],
  '/api/download/youtube': ['youtube', ['ytdl', 'yt']], '/api/download/ytmp3': ['ytmp3', ['yta']], '/api/download/ytmp4': ['ytmp4', ['ytv', 'ytvideo']],
  '/api/download/play': ['play', ['song', 'lagu']], '/api/download/spotify': ['spotifydl', []], '/api/download/mediafire': ['mediafire', ['mf']],
  '/api/download/capcut': ['capcut', ['capcutdl']], '/api/download/pinterest': ['pindl', ['pinterestdl']], '/api/download/threads': ['threads', ['threadsdl']],
  '/api/download/gdrive': ['gdrive', ['gdrivedl']], '/api/download/soundcloud': ['soundclouddl', ['scdl']], '/api/download/aio': ['aio', ['allinone', 'downloadall']],
  '/api/download/terabox': ['terabox', []], '/api/download/applemusic': ['applemusicdl', []], '/api/download/snackvideo': ['snackvideo', []],
  '/api/search/spotify': ['spotify', ['spsearch']], '/api/search/pinterest': ['pinterest', ['pin']], '/api/search/youtube': ['yts', ['ytsearch']],
  '/api/search/tiktok': ['ttsearch', ['tiktoksearch']], '/api/search/soundcloud': ['soundcloud', ['scsearch']], '/api/search/npm': ['npmsearch', ['npm']],
  '/api/search/google': ['google', []], '/api/search/wikipedia': ['wiki', ['wikipedia']], '/api/search/kbbi': ['kbbi', []], '/api/search/image': ['gimage', ['image']],
  '/api/search/spotify-lirik': ['lirik', ['lyrics', 'lyric']], '/api/search/stickerly': ['stickersearch', ['caristicker']], '/api/search/github': ['githubsearch', []],
  '/api/search/playstore': ['playstore', []], '/api/apk/playstore': ['apkplaystore', []], '/api/search/resep': ['resep', []], '/api/search/myanimelist': ['mal', ['myanimelist']],
  '/api/ai/chatgpt': ['ai', ['chatgpt', 'gpt', 'openai']], '/api/ai/gemini': ['gemini', ['bard2']], '/api/ai/claude': ['claude', []], '/api/ai/copilot': ['copilot', []],
  '/api/ai/blackbox': ['blackbox', []], '/api/ai/deepai': ['deepai', []], '/api/ai/kimi': ['kimi', ['kimiai']], '/api/ai/qwen': ['qwen', []], '/api/ai/simisimi': ['simi', ['simisimi']],
  '/api/ai/flux': ['flux', ['txt2img']], '/api/ai/text-to-image': ['texttoimage', ['buatgambar']], '/api/ai/image-gen': ['imagegen', ['genimage']],
  '/api/ai/gemini-vision': ['geminivision', ['analisisgambar']], '/api/ai/nano-banana': ['nanobanana', ['banana']], '/api/ai/bard': ['bard', []],
  '/api/tools/removebg': ['removebg', ['rbg', 'nobg', 'hapusbg']], '/api/tools/upscale': ['upscale', ['hd', 'hdr']], '/api/maker/remini': ['remini', []],
  '/api/tools/ocr': ['ocr', []], '/api/tools/translate': ['translate', ['tr', 'terjemah']], '/api/tools/screenshot': ['ssweb', ['screenshot']],
  '/api/tools/shortlink': ['shortlink', ['shorturl']], '/api/tools/tinyurl': ['tinyurl', []], '/api/tools/text-to-speech': ['tts', ['texttospeech']],
  '/api/tools/text2qr': ['qr', ['qrcode', 'text2qr']], '/api/tools/dewatermark': ['dewatermark', ['hapuswm', 'removewm']], '/api/tools/vision': ['vision', []],
  '/api/tools/image-to-prompt': ['toprompt', ['imagetoprompt']], '/api/tools/compress': ['compress', ['kompres']], '/api/tools/youtube-summarize': ['ytsummarizer', ['ytsummary']],
  '/api/tools/whatsmusic': ['whatmusic', ['whatmusik']], '/api/tools/currency': ['kurs', ['currency']], '/api/tools/dns': ['dns', []], '/api/tools/trackip': ['ipinfo', ['trackip']],
  '/api/maker/brat': ['brat', []], '/api/maker/bratvid': ['bratvid', ['bratvideo']], '/api/maker/qc': ['qc', ['quotly']], '/api/maker/attp': ['attp', []], '/api/maker/ttp': ['ttp', []],
  '/api/maker/carbon': ['carbon', ['carbonify']], '/api/maker/smeme': ['smeme', ['stickermeme']], '/api/maker/emojimix': ['emojimix', []], '/api/maker/nulis': ['nulis', ['tulis']],
  '/api/canvas/iqc': ['iqc', []], '/api/canvas/welcome': ['welcomecard', []], '/api/canvas/goodbye': ['goodbyecard', []], '/api/canvas/profile': ['profilecard', []],
  '/api/canvas/ship': ['shipcard', []], '/api/canvas/rankcard': ['rankcard', []], '/api/canvas/kalender': ['kalendercanvas', []],
  '/api/stalk/instagram': ['igstalk', ['instagramstalk']], '/api/stalk/tiktok': ['tiktokstalk', ['ttstalk']], '/api/stalk/github': ['githubstalk', ['stalkgithub']],
  '/api/stalk/freefire': ['ffstalk', ['stalkff']], '/api/stalk/roblox': ['robloxstalk', ['stalkroblox']], '/api/stalk/youtube': ['ytstalk', []], '/api/stalk/twitter': ['twitterstalk', []],
  '/api/check/mlbb': ['mlstalk', ['stalkml', 'cekml']], '/api/info/gempa': ['gempa', ['infogempa', 'cekgempa']], '/api/info/cuaca/v1': ['cuaca', ['cekcuaca']],
  '/api/info/jadwal-sholat': ['jadwalsholat', ['sholat']], '/api/info/hari-libur': ['harilibur', ['libur']], '/api/info/jadwaltv': ['jadwaltv', []], '/api/info/jadwalbola': ['jadwalbola', []],
  '/api/islamic/ayatkursi': ['ayatkursi', []], '/api/islamic/doaharian': ['doaharian', ['doa']], '/api/islamic/bacaanshalat': ['bacaansholat', []], '/api/islamic/wirid': ['wirid', []],
  '/api/islamic/tahlil': ['tahlil', []], '/api/islamic/surah': ['surah', ['quran']], '/api/islamic/kisahnabi': ['kisahnabiapi', []], '/api/audio/murotal': ['murotalapi', []],
  '/api/random/truth': ['truth', []], '/api/random/dare': ['dare', []], '/api/random/meme': ['meme', []], '/api/random/waifu': ['waifu', []], '/api/random/neko': ['neko', []],
  '/api/random/quotes': ['quotes', []], '/api/random/fakta': ['fakta', ['faktaunik']], '/api/random/anime-quote': ['animequote', ['quotesanime']], '/api/random/puisi': ['puisi', []],
  '/api/random/cerpen': ['cerpen', []], '/api/fun/alay': ['alayapi', []], '/api/primbon/artinama': ['artinama', []], '/api/primbon/tafsir-mimpi': ['tafsirmimpi', ['mimpi']],
  '/api/primbon/zodiac': ['zodiak', ['zodiac']], '/api/primbon/nomorhoki': ['nomorhoki', []], '/api/primbon/cocokpasangan': ['cocokpasangan', []], '/api/primbon/ramaljodoh': ['ramaljodoh', []],
  '/api/news/cnn': ['cnn', ['berita']], '/api/news/detik': ['detik', []], '/api/news/kompas': ['kompas', []], '/api/news/cnbc': ['cnbc', []], '/api/news/antara': ['antara', []]
};
// Kata kategori di path yang dibuang saat membuat nama otomatis.
const GENERIC = new Set(['download', 'search', 'ai', 'tools', 'maker', 'canvas', 'stalk', 'news', 'games', 'game', 'random', 'info', 'primbon', 'textpro', 'islamic', 'fun', 'image', 'imgedit', 'ephoto', 'check', 'analyze', 'comments', 'apk', 'detail', 'top', 'audio', 'lk21', 'manga']);
const CATEGORY = { ai: 'ai', downloader: 'downloader', search: 'search', tools: 'tools', maker: 'maker', canvas: 'canvas', stalk: 'stalk', news: 'news', games: 'games', random: 'random', info: 'info', primbon: 'primbon', textpro: 'textpro', islamic: 'islamic', anime: 'anime', fun: 'fun', image: 'image', check: 'check', movie: 'movie', music: 'music', ephoto: 'ephoto' };
const AUTO_FILL = new Set(['avatar', 'avatar1', 'pp', 'profile', 'username', 'name', 'guildName', 'memberCount', 'nama']);

function autoName(p) {
  const segs = p.replace(/^\/api\//, '').split('/');
  const body = (segs.length > 1 && GENERIC.has(segs[0]) ? segs.slice(1) : segs).join('').replace(/-v(\d+)$/, '$1').replace(/[^a-z0-9]/gi, '').toLowerCase();
  return { name: body.slice(0, 40), full: segs.join('').replace(/-v(\d+)$/, '$1').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 40) };
}

function usageOf(ep) {
  const req = ep.params.filter(p => p.required && !p.file);
  const opt = ep.params.filter(p => !p.required && !p.file);
  const file = ep.params.find(p => p.file);
  return [req.map(p => `<${p.name}>`).join('|'), opt.length ? `[${opt.map(p => `${p.name}=${p.options ? p.options.slice(0, 3).join('/') : '…'}`).join(' ')}]` : '', file ? `(+kirim/reply media${file.required ? '' : ', opsional'})` : ''].filter(Boolean).join(' ');
}

// Teks pengguna -> object parameter.
function parseInput(ep, text, { hasFile }) {
  const params = {};
  const names = new Set(ep.params.flatMap(p => [p.name, ...(p.aliases || [])]));
  let rest = String(text || '');
  rest = rest.replace(/(?:^|\s)([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|\S+)/g, (m, k, v) => { if (!names.has(k)) return m; params[k] = v.replace(/^"|"$/g, ''); return ' '; }).trim();
  const missing = ep.params.filter(p => p.required && params[p.name] === undefined && !(p.file && hasFile));
  if (rest) {
    if (missing.length <= 1) { const target = missing[0] || ep.params.find(p => !p.file && params[p.name] === undefined); if (target) params[target.name] = rest; else throw new UsageError(`Endpoint ini tidak butuh teks. Pakai key=value.`); }
    else { const parts = rest.split('|').map(s => s.trim()); missing.forEach((p, i) => { if (parts[i]) params[p.name] = parts[i]; }); }
  }
  return params;
}

async function autoFill(ctx, ep, params) {
  const s = ctx.yannajah.socket;
  for (const p of ep.params) {
    if (params[p.name] !== undefined || !AUTO_FILL.has(p.name) || !p.required) continue;
    if (/^(avatar|avatar1|pp|profile)$/.test(p.name) && s) params[p.name] = await s.profilePictureUrl(ctx.m.sender, 'image').catch(() => null) || 'https://i.ibb.co/2kR6HwV/avatar.png';
    if (/^(username|name|nama)$/.test(p.name)) params[p.name] = (ctx.m.pushName || 'User').slice(0, 30);
    if (p.name === 'guildName') params[p.name] = ctx.m.groupMetadata?.subject || ctx.config.bot.name;
    if (p.name === 'memberCount') params[p.name] = String(ctx.m.groupMetadata?.participants?.length || 1);
  }
}

function build(registry) {
  const { map } = loadCatalog();
  const used = new Set(registry ? registry.commands.keys() : []);   // nama fitur lokal diprioritaskan
  const out = [];
  const eps = [...map.values()].filter(e => !e.excluded);
  // Nama khusus dulu, lalu otomatis; tabrakan -> pakai nama lengkap (dengan kategori) lalu sufiks angka.
  for (const pass of [true, false]) {
    for (const ep of eps) {
      if (Boolean(NAMES[ep.path]) !== pass) continue;
      let name, aliases = [];
      const a = autoName(ep.path);
      if (NAMES[ep.path]) [name, aliases] = NAMES[ep.path];
      else name = used.has(a.name) || !a.name ? a.full : a.name;
      if (used.has(name)) name = a.full;
      if (/^\d/.test(name)) name = 'x' + name;
      let n = 2; const base = name; while (used.has(name)) name = `${base}${n++}`;
      aliases = (aliases || []).filter(x => !used.has(x));
      used.add(name); aliases.forEach(x => used.add(x));
      const category = CATEGORY[ep.category.toLowerCase()] || ep.category.toLowerCase().replace(/[^a-z]/g, '') || 'tools';
      const fileParam = ep.params.find(p => p.file);
      out.push(feature({
        id: `apiz2z.${ep.path.replace(/^\/api\//, '').replace(/[^a-z0-9]+/gi, '.').toLowerCase().replace(/^\.|\.$/g, '')}`,
        name, aliases, category, source: 'apiz2z',
        description: `${ep.name}: ${ep.desc}`.slice(0, 300),
        usage: usageOf(ep),
        params: ep.params.map(p => ({ name: p.name, required: p.required, file: Boolean(p.file), options: p.options })),
        dependencies: { apiz2z: ep.path },
        limit: 1, cooldown: 5,
        endpoint: ep,
        async run(ctx) {
          const md = fileParam ? ctx.media() : null;
          let text = ctx.text;
          if (!text && ctx.m.quoted?.text && !md) text = ctx.m.quoted.text;
          const params = parseInput(ep, text, { hasFile: Boolean(md) });
          await autoFill(ctx, ep, params);
          const missing = ep.params.filter(p => p.required && params[p.name] === undefined && !(p.file && md));
          if (missing.length) throw new UsageError(`Parameter kurang: ${missing.map(p => p.file ? `${p.name} (kirim/reply media atau URL)` : p.name).join(', ')}\n${ctx.usage()}`);
          await ctx.react('⏳');
          const result = md
            ? await ctx.api.post(ep.path, params, { buffer: await md.download(), mime: md.mime })
            : await ctx.api.get(ep.path, params);
          const r = render(result, { category, title: ep.name });
          let sent = false;
          for (const f of r.files) {
            try { await ctx.sendFile(f.buffer ? { buffer: f.buffer, mime: f.mime } : f.url, { caption: r.text ? r.text.slice(0, 1000) : '' }); sent = true; }
            catch (e) { ctx.logger.warn('kirim media APIZ2Z gagal', { path: ep.path, code: e.code }); }
          }
          if (!sent && r.text) await ctx.reply(r.text);
          else if (sent && r.text && r.text.length > 1000) await ctx.reply(r.text);
          else if (!sent && !r.text) await ctx.reply('Respons kosong dari server API.');
          await ctx.react('✅');
        }
      }));
    }
  }
  return out;
}

module.exports = registry => build(registry);
module.exports.parseInput = parseInput;
module.exports.autoName = autoName;
module.exports.NAMES = NAMES;
