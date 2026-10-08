'use strict';
// Website background music: the sound of one TikTok video (SITE_MUSIC_URL), played by the widget in
// views/music.js. The audio link is looked up on the server through the AIO downloader
// (api.theresav.eu/api/download/aio, the same upstream as /api/download/aio), with tikwm (as used by
// plugin/tiktok.js) as a fallback. TikTok audio links expire, so the result is cached for a while
// and looked up again later. The upstream key never reaches the browser.
const DEFAULT_URL = 'https://vt.tiktok.com/ZSbpMHCBM/';
const CACHE_MS = 30 * 60 * 1000;
const FAIL_CACHE_MS = 60 * 1000;
const TIMEOUT_MS = 20000;

const sourceUrl = () => {
  const v = String(process.env.SITE_MUSIC_URL ?? '').trim();
  return v.toLowerCase() === 'off' ? null : v || DEFAULT_URL;
};

let cache = null;      // { at, value: { audio, title, author, via } | null }
let pending = null;

async function getJson(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: controller.signal });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch { return null; } finally { clearTimeout(timer); }
}

const isHttp = v => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v);
const MUSIC_KEY = /^(music|music_url|musicurl|audio|audio_url|audiourl|mp3|sound|sound_url)$/i;
const MUSIC_OBJ = /^(music|music_info|musicinfo|audio|sound)$/i;

// Finds the audio link in a downloader answer, whatever its exact shape: a string under a
// music/audio key, { url | play } inside a music object, or a media item labelled audio/mp3.
function findAudio(node, depth = 0) {
  if (!node || depth > 7 || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) { const hit = findAudio(item, depth + 1); if (hit) return hit; }
    return null;
  }
  for (const [k, v] of Object.entries(node)) if (MUSIC_KEY.test(k) && isHttp(v)) return v;
  for (const [k, v] of Object.entries(node)) {
    if (MUSIC_OBJ.test(k) && v && typeof v === 'object' && !Array.isArray(v)) {
      for (const f of ['url', 'play', 'play_url', 'playUrl', 'link', 'download', 'src']) if (isHttp(v[f])) return v[f];
    }
  }
  const label = ['type', 'quality', 'format', 'mimeType', 'mime', 'extension', 'ext'].map(f => (typeof node[f] === 'string' ? node[f] : '')).join(' ').toLowerCase();
  const link = ['url', 'link', 'download', 'src'].map(f => node[f]).find(isHttp);
  if (link && /\b(audio|mp3|m4a|music)\b/.test(label)) return link;
  for (const v of Object.values(node)) {
    if (v && typeof v === 'object') { const hit = findAudio(v, depth + 1); if (hit) return hit; }
  }
  return null;
}

// Song title / artist from a music object if there is one, else the top-level title.
function findMeta(node, depth = 0) {
  if (!node || depth > 7 || typeof node !== 'object') return null;
  for (const [k, v] of Object.entries(node)) {
    if (MUSIC_OBJ.test(k) && v && typeof v === 'object' && typeof v.title === 'string' && v.title.trim()) {
      const author = typeof v.author === 'string' ? v.author : typeof v.author?.nickname === 'string' ? v.author.nickname : typeof v.artist === 'string' ? v.artist : null;
      return { title: v.title.trim(), author: author ? author.trim() : null };
    }
  }
  for (const v of Object.values(node)) {
    if (v && typeof v === 'object') { const hit = findMeta(v, depth + 1); if (hit) return hit; }
  }
  return null;
}

const clean = (s, max) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) || null : null);

async function viaAio(url) {
  const key = process.env.THERESAV_API_KEY;
  if (!key) return null;
  const base = (process.env.THERESAV_BASE_URL || 'https://api.theresav.eu').replace(/\/+$/, '');
  const data = await getJson(`${base}/api/download/aio?${new URLSearchParams({ url })}`, { headers: { 'x-apikey': key, Accept: 'application/json' } });
  const audio = data && data.status !== false ? findAudio(data) : null;
  if (!audio) return null;
  const meta = findMeta(data) || {};
  return { audio, title: meta.title || (typeof data.result?.title === 'string' ? data.result.title : null), author: meta.author || null, via: 'aio' };
}

async function viaTikwm(url) {
  const data = await getJson(`https://www.tikwm.com/api/?${new URLSearchParams({ url, hd: '1' })}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Origin: 'https://www.tikwm.com', Referer: 'https://www.tikwm.com/', 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest' }
  });
  const d = data?.data;
  const audio = isHttp(d?.music) ? d.music : isHttp(d?.music_info?.play) ? d.music_info.play : null;
  if (!audio) return null;
  return { audio, title: d.music_info?.title || null, author: d.music_info?.author || null, via: 'tikwm' };
}

// { audio, title, author, via } or null. Cached; concurrent callers share one lookup.
async function resolve() {
  const src = sourceUrl();
  if (!src) return null;
  if (cache && Date.now() - cache.at < (cache.value ? CACHE_MS : FAIL_CACHE_MS)) return cache.value;
  if (!pending) {
    pending = (async () => {
      const found = (await viaAio(src)) || (await viaTikwm(src));
      const value = found ? { ...found, title: clean(found.title, 120), author: clean(found.author, 80) } : null;
      cache = { at: Date.now(), value };
      return value;
    })().finally(() => { pending = null; });
  }
  return pending;
}

const enabled = () => Boolean(sourceUrl());
const reset = () => { cache = null; };

module.exports = { resolve, enabled, findAudio, findMeta, reset, DEFAULT_URL };
