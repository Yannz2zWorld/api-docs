'use strict';
// Endpoint bawaan dari data/endpoints.json (spec lengkap, server-only) + tampilan publik tanpa info provider.
const RAW = require('../data/endpoints.json');
const PROVIDERS = require('./providers');

// Kategori mengikuti segmen pertama path: /api/(path)/(fitur)
const CATEGORY = { ai: 'AI', download: 'Downloader', search: 'Search', tools: 'Tools', maker: 'Maker', canvas: 'Canvas', textpro: 'Textpro', ephoto: 'Ephoto', primbon: 'Primbon', games: 'Games', random: 'Random', stalk: 'Stalk', news: 'News', islamic: 'Islamic', info: 'Info', anime: 'Anime', fun: 'Fun' };

// Plan bawaan endpoint. Provider tidak menandai endpoint premium secara terbuka, jadi ini pilihan awal
// berdasarkan "berat"-nya fitur; developer bisa mengubah plan tiap endpoint dari Developer panel.
const PLAN_RULES = [
  ['nebula',  /\/api\/ai\/(gpt|qwen)$|\/api\/image\/lumiart|video-gen|img2video|text2video/],
  ['super',   /\/api\/download\/(youtube|ytmp4|ytdl|ytmp3|spotify|play)(-v\d)?$|\/api\/ai\/.*(voice|tts)/],
  ['premium', /nano-banana|img2img|imgedit|upscale|remini|removebg|enhance|hd(-v\d)?$|txt2img|text2img|image-gen|flux|deepimg|ghibli|toanime|tofigure/]
];
function defaultPlan(spec) {
  for (const [plan, re] of PLAN_RULES) if (re.test(spec.path)) return plan;
  return 'free';
}

function guessOutput(spec) {
  const s = `${spec.path} ${spec.name} ${spec.desc}`.toLowerCase();
  if (spec.category === 'Downloader') return /mp3|audio|music|lagu|spotify|soundcloud|play/.test(s) ? 'audio' : 'video';
  if (['Canvas', 'Textpro', 'Ephoto', 'Maker'].includes(spec.category)) return /bratvid|brat-video|video/.test(s) ? 'video' : 'image';
  if (/tts|voice|suara/.test(s)) return 'audio';
  if (/image|gambar|txt2img|text2img|imagine|photo|foto|remini|removebg|upscale|ssweb|screenshot/.test(s)) return 'image';
  return 'json';
}

const BUILTIN = [];
for (const spec of RAW) {
  if (!PROVIDERS[spec.server]) continue;
  const parts = spec.path.split('/').filter(Boolean).slice(1);
  // Selalu dua level: /api/anime/komiku/detail -> /api/anime/komiku-detail
  const path = parts.length > 2 ? `/api/${parts[0]}/${parts.slice(1).join('-')}` : spec.path;
  const category = CATEGORY[parts[0]] || spec.category || 'Tools';
  const s = { ...spec, path, category };
  s.plan = defaultPlan(s);
  s.output = guessOutput(s);
  BUILTIN.push(s);
}

// Yang boleh dilihat pemanggil API: tanpa server, upstream, rename, key, dll.
function publicView(spec) {
  const upload = spec.file || null;
  return {
    name: spec.name,
    desc: spec.desc || '',
    category: spec.category,
    path: spec.path,
    method: upload ? 'GET/POST' : 'GET',
    output: spec.output || 'json',
    plan: spec.plan || 'free',
    locked: Boolean(spec.locked),
    hidden: Boolean(spec.hidden),
    upload: upload ? { param: upload.param, accept: upload.accept || 'image/*' } : null,
    params: (spec.params || []).map(p => ({
      name: p.name,
      required: Boolean(p.required),
      placeholder: p.placeholder || (p.options ? p.options.join(' / ') : ''),
      ...(p.default !== undefined ? { default: p.default } : {}),
      ...(p.options ? { options: p.options } : {})
    })),
    example: spec.sample || null
  };
}

module.exports = { BUILTIN, publicView, guessOutput, CATEGORY };
