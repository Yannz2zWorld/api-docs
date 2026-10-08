'use strict';
// Website background music, played by the widget in views/music.js.
//   Default: the full song bundled with the site, views/assets/site-music.mp3 (served at
//   /assets/site-music.mp3), complete and uncut. Its name comes from SITE_MUSIC_TITLE /
//   SITE_MUSIC_ARTIST.
//   SITE_MUSIC_URL=<TikTok link>: the sound of that video instead, looked up on the server through
//   the AIO downloader (api.theresav.eu/api/download/aio) with tikwm (as used by plugin/tiktok.js)
//   as a fallback; TikTok audio links expire, so the result is cached and looked up again later.
//   The upstream key never reaches the browser.
//   SITE_MUSIC_URL=off: no music player.
const path = require('path');
const fs = require('fs');
const DEFAULT_URL = 'https://vt.tiktok.com/ZSbpMHCBM/';   // where the bundled song comes from
const LOCAL_FILE = path.join(__dirname, '..', 'views', 'assets', 'site-music.mp3');
let localVersion = null;
function localSrc() {
  if (localVersion == null) { try { localVersion = String(fs.statSync(LOCAL_FILE).size); } catch { localVersion = ''; } }
  return localVersion ? `/assets/site-music.mp3?v=${localVersion}` : null;
}
const CACHE_MS = 30 * 60 * 1000;
const FAIL_CACHE_MS = 60 * 1000;
const TIMEOUT_MS = 20000;

const setting = () => String(process.env.SITE_MUSIC_URL ?? '').trim();
const mode = () => { const v = setting(); return v.toLowerCase() === 'off' ? 'off' : v ? 'tiktok' : 'file'; };
const sourceUrl = () => (mode() === 'tiktok' ? setting() : null);

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
  const m = mode();
  if (m === 'off') return null;
  if (m === 'file') {
    const audio = localSrc();
    return audio ? { audio, title: clean(process.env.SITE_MUSIC_TITLE, 120), author: clean(process.env.SITE_MUSIC_ARTIST, 80), via: 'file', local: true } : null;
  }
  const src = sourceUrl();
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

const enabled = () => mode() !== 'off';
const reset = () => { cache = null; };

module.exports = { resolve, enabled, mode, findAudio, findMeta, reset, DEFAULT_URL, LOCAL_FILE };
