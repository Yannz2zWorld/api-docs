'use strict';
// Katalog endpoint: data/endpoints.json (spec lengkap, server-only) -> versi publik tanpa info provider.
const RAW = require('../data/endpoints.json');
const PROVIDERS = require('./providers');

// Kategori mengikuti segmen pertama path: /api/(path)/(fitur)
const CATEGORY = { ai: 'AI', download: 'Downloader', search: 'Search', tools: 'Tools', maker: 'Maker', canvas: 'Canvas', textpro: 'Textpro', ephoto: 'Ephoto', primbon: 'Primbon', games: 'Games', random: 'Random', stalk: 'Stalk', news: 'News', islamic: 'Islamic', info: 'Info', anime: 'Anime', fun: 'Fun' };

const BY_PATH = new Map();
for (const spec of RAW) {
  if (!PROVIDERS[spec.server]) continue;
  // Selalu dua level: /api/anime/komiku/detail -> /api/anime/komiku-detail
  const parts = spec.path.split('/').filter(Boolean).slice(1);
  if (parts.length > 2) spec.path = `/api/${parts[0]}/${parts.slice(1).join('-')}`;
  const seg = parts[0];
  spec.category = CATEGORY[seg] || spec.category || 'Tools';
  BY_PATH.set(spec.path.toLowerCase(), spec);
}

// Respons yang kemungkinan didapat (buat badge di UI): ditebak dari kategori/nama.
function guessOutput(spec) {
  const s = `${spec.path} ${spec.name} ${spec.desc}`.toLowerCase();
  if (spec.category === 'Downloader') return /mp3|audio|music|lagu|spotify|soundcloud/.test(s) ? 'audio' : 'video';
  if (['Canvas', 'Textpro', 'Ephoto', 'Maker'].includes(spec.category)) return /bratvid|brat-video|video/.test(s) ? 'video' : 'image';
  if (/tts|voice|suara/.test(s)) return 'audio';
  if (/image|gambar|txt2img|text2img|imagine|photo|foto|remini|removebg|upscale|ssweb|screenshot/.test(s)) return 'image';
  return 'json';
}

function publicView(spec) {
  const upload = spec.file || null;
  return {
    name: spec.name,
    desc: spec.desc,
    category: spec.category,
    path: spec.path,
    method: upload ? 'GET/POST' : 'GET',
    output: guessOutput(spec),
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

const PUBLIC = [...BY_PATH.values()].map(publicView).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
const find = path => BY_PATH.get(String(path).toLowerCase().replace(/\/+$/, ''));

module.exports = { find, list: () => PUBLIC, size: () => PUBLIC.length };
