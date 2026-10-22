'use strict';
// Mengubah respons APIZ2Z menjadi pesan WhatsApp sesuai bentuk SEBENARNYA:
//   - media biner (image/video/audio)      -> dikirim sebagai file
//   - JSON dengan link media di hasilnya    -> media utama diunduh (anti-SSRF) + ringkasan teks
//   - JSON teks (AI, info, search)          -> teks rapi (dibatasi panjangnya)
//   - teks biasa                            -> teks
// Tidak ada asumsi semua respons JSON.

const { truncate } = require('./function');

const MEDIA_EXT = /\.(mp4|mov|webm|mkv|m4v|mp3|m4a|aac|ogg|opus|wav|flac|jpe?g|png|webp|gif|bmp)(\?|#|$)/i;
const MEDIA_KEY = /^(url|link|download|download_?url|dl|dl_?link|video|video_?url|hd|hdplay|nowm|no_?watermark|play|wmplay|audio|audio_?url|music|mp3|mp4|image|image_?url|img|thumbnail|thumb|cover|result|media|file|src|stream)$/i;
const SKIP_KEY = /^(status|creator|code|success|message_id|timestamp|response_time)$/i;
const TEXT_KEYS = ['result', 'answer', 'response', 'reply', 'message', 'text', 'content', 'output', 'data'];
const isUrl = v => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v);

function kindOfUrl(key, url) {
  const k = String(key || '').toLowerCase();
  const ext = (MEDIA_EXT.exec(url) || [])[1]?.toLowerCase();
  if (/video|nowm|hdplay|^hd$|mp4|wmplay|^play$/.test(k) || /mp4|mov|webm|mkv|m4v/.test(ext || '')) return 'video';
  if (/audio|music|mp3|sound/.test(k) || /mp3|m4a|aac|ogg|opus|wav|flac/.test(ext || '')) return 'audio';
  if (/image|img|thumb|cover|photo|picture|avatar/.test(k) || /jpe?g|png|webp|gif|bmp/.test(ext || '')) return 'image';
  if (/\/media\/[A-Za-z0-9_-]+/.test(url)) return 'media';   // link proxy media APIZ2Z (/media/<token>)
  return null;
}

// Kumpulkan link media dari hasil (maks kedalaman 5).
function collectMedia(obj) {
  const found = [];
  const walk = (v, key, depth) => {
    if (depth > 5 || found.length > 30) return;
    if (isUrl(v)) { const kind = kindOfUrl(key, v); if (kind && (MEDIA_KEY.test(String(key)) || MEDIA_EXT.test(v) || kind === 'media')) found.push({ key: String(key), url: v, kind }); return; }
    if (Array.isArray(v)) { v.slice(0, 20).forEach(x => walk(x, key, depth + 1)); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!SKIP_KEY.test(k)) walk(x, k, depth + 1);
  };
  walk(obj, 'result', 0);
  const rank = { video: 0, audio: 1, media: 2, image: 3 };
  const thumbs = /thumb|cover|avatar/i;
  return found.sort((a, b) => (thumbs.test(a.key) - thumbs.test(b.key)) || rank[a.kind] - rank[b.kind]);
}

// Ringkas object jadi teks "kunci: nilai" (tanpa token/secret, tanpa nilai kosong).
function summarize(obj, { maxLines = 40, maxLen = 3500 } = {}) {
  const lines = [];
  const label = k => String(k).replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase());
  const walk = (v, prefix, depth) => {
    if (lines.length >= maxLines) return;
    if (v === null || v === undefined || v === '') return;
    if (typeof v !== 'object') { lines.push(`${prefix ? `*${label(prefix)}:* ` : ''}${String(v).slice(0, 600)}`); return; }
    if (Array.isArray(v)) {
      if (!v.length) return;
      if (v.every(x => typeof x !== 'object')) { lines.push(`${prefix ? `*${label(prefix)}:* ` : ''}${v.slice(0, 15).join(', ')}`); return; }
      v.slice(0, 10).forEach((x, i) => {
        if (lines.length >= maxLines) return;
        const title = x && typeof x === 'object' ? (x.title || x.name || x.judul || x.nama || x.username || x.text || x.berita || '') : '';
        lines.push(`\n${i + 1}. ${title ? `*${String(title).slice(0, 150)}*` : ''}`);
        if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) if (!SKIP_KEY.test(k) && y !== title && depth < 3 && (typeof y !== 'object' || y === null)) walk(y, k, depth + 1);
        else walk(x, '', depth + 1);
      });
      if (v.length > 10) lines.push(`…dan ${v.length - 10} lainnya`);
      return;
    }
    for (const [k, x] of Object.entries(v)) if (!SKIP_KEY.test(k) && !/(token|apikey|api_key|secret|password)/i.test(k)) walk(x, prefix && depth > 0 ? `${prefix} ${k}` : k, depth + 1);
  };
  walk(obj, '', 0);
  return truncate(lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), maxLen);
}

function payloadOf(data) {
  if (!data || typeof data !== 'object') return data;
  const { status, creator, ...rest } = data;
  if (rest.result !== undefined && Object.keys(rest).length === 1) return rest.result;
  if (rest.data !== undefined && Object.keys(rest).length === 1) return rest.data;
  return rest;
}

// Teks utama untuk jawaban AI / respons teks tunggal.
function primaryText(p) {
  if (typeof p === 'string') return p;
  if (p && typeof p === 'object' && !Array.isArray(p)) for (const k of TEXT_KEYS) if (typeof p[k] === 'string' && p[k].length > 0 && !isUrl(p[k])) return p[k];
  return null;
}

/**
 * render(result, { category, title }) -> { files: [{ url | buffer, mime, kind }], text }
 */
function render(result, { category = '', title = '' } = {}) {
  if (result.kind === 'media') return { files: [{ buffer: result.buffer, mime: result.mime }], text: '' };
  if (result.kind === 'text') return { files: [], text: truncate(result.text, 4000) };
  const p = payloadOf(result.data);
  const cat = String(category).toLowerCase();
  const text = primaryText(p);
  if (cat === 'ai' && text) return { files: collectMedia(p).filter(m => m.kind === 'image').slice(0, 1).map(m => ({ url: m.url, kind: m.kind })), text: truncate(text, 6000) };
  const media = collectMedia(p);
  const sendMedia = ['downloader', 'maker', 'canvas', 'image', 'textpro', 'ephoto', 'random', 'music'].includes(cat) || (media.length && !['search', 'news', 'info', 'stalk', 'anime', 'primbon', 'games', 'islamic', 'check', 'fun', 'movie'].includes(cat));
  const files = sendMedia && media.length ? [media[0]].map(m => ({ url: m.url, kind: m.kind })) : [];
  const body = text && typeof p !== 'object' ? text : summarize(p);
  return { files, text: `${title ? `*${title}*\n` : ''}${body || '(respons kosong)'}` };
}

module.exports = { render, collectMedia, summarize, payloadOf, primaryText, kindOfUrl };
