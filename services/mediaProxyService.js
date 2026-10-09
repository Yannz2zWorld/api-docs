'use strict';
// Media links in API results open on our own domain, never on the source's.
//
// rewrite(): before an endpoint's JSON answer goes out, every link to a picture / video / audio /
// file in it (e.g. https://api.dongtube.id/media/abc.mp3, https://i.pinimg.com/...jpg) is replaced
// with https://<our domain>/media/<token>. The token is the original link plus an HMAC signature,
// so only links our own API handed out can be opened: /media is not an open proxy.
//
// open(): the first time a /media link is opened, the file is fetched from the source (public hosts
// only, every redirect checked) and kept in our CDN table (cdn_files) for STORE_DAYS days; later
// opens are served from there, even if the source link has expired. Files above the CDN's 4 MB
// (long videos) are passed through from the source instead of stored. Either way the visitor stays
// on our domain.
const crypto = require('crypto');
const { query } = require('../lib/db');
const cdn = require('./cdnService');
const { publicHost } = require('../lib/theresav');

const STORE_DAYS = 7;
const FETCH_TIMEOUT_MS = 25000;
const MAX_LINKS = 400;   // per answer

// ---------------------------------------------------------------- which links are media
const MEDIA_EXT = /\.(jpe?g|png|gif|webp|bmp|avif|heic|ico|mp4|m4v|webm|mov|mkv|3gp|mp3|m4a|aac|ogg|oga|opus|wav|flac|pdf|zip|rar|7z|apk|tgz|gz)$/i;
// Keys that hold a media link even when the link has no file extension (TikTok / CDN links).
const MEDIA_KEY = /(image|img|thumb|cover|avatar|photo|picture|pic|icon|logo|banner|poster|video|audio|music|song|mp3|mp4|media|download|^dl|hdplay|wmplay|^play$|preview|sticker|gif|wallpaper|artwork)/i;
// An object describing a file ({ url, quality, extension }, { url, type: 'video' } ...): its url is the file.
const FILE_SIBLINGS = ['extension', 'ext', 'quality', 'mimeType', 'mimetype', 'mime', 'resolution', 'bitrate', 'filesize', 'format'];
// Upstream API servers: what they link to is their own media.
const UPSTREAM_HOSTS = new Set(['api.dongtube.id', 'api.theresav.eu', 'api.clutch.web.id', 'cdn-alip.clutch.web.id', 'api.termai.cc', 'api-faa.my.id', 'api.pitucode.com']);

function isMediaLink(key, value, parent) {
  if (typeof value !== 'string' || value.length > 4000 || !/^https?:\/\//i.test(value)) return false;
  let u;
  try { u = new URL(value); } catch { return false; }
  if (MEDIA_EXT.test(u.pathname)) return true;
  if (UPSTREAM_HOSTS.has(u.hostname) && u.pathname.length > 1) return true;
  if (typeof key === 'string' && MEDIA_KEY.test(key)) return true;
  if (parent && typeof parent === 'object' && !Array.isArray(parent)) {
    if (FILE_SIBLINGS.some(k => k in parent)) return true;
    if (typeof parent.type === 'string' && /^(image|video|audio|photo)/i.test(parent.type)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- signed tokens
const secret = () => process.env.MEDIA_SECRET || process.env.AUTH_SECRET || '';
const b64 = s => Buffer.from(s).toString('base64url');
const sig = url => crypto.createHmac('sha256', 'media:' + secret()).update(url).digest('base64url').slice(0, 22);
function extOf(url) { try { const m = new URL(url).pathname.match(MEDIA_EXT); return m ? m[1].toLowerCase() : null; } catch { return null; } }
function tokenFor(url) { const ext = extOf(url); return `${b64(url)}.${sig(url)}${ext ? '.' + ext : ''}`; }
function urlOf(token) {
  const [data, given] = String(token || '').split('.');
  if (!data || !given || data.length > 6000) return null;
  let url;
  try { url = Buffer.from(data, 'base64url').toString('utf8'); } catch { return null; }
  const want = sig(url);
  if (given.length !== want.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(want))) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}

// ---------------------------------------------------------------- rewriting answers
function baseOf(req) {
  return (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '') || `${req.protocol || 'https'}://${req.get('host')}`;
}
function rewrite(body, req) {
  if (!body || typeof body !== 'object' || !secret()) return body;
  const base = baseOf(req);
  let ownHost = null;
  try { ownHost = new URL(base).host; } catch {}
  let left = MAX_LINKS;
  const walk = (v, key, parent, depth) => {
    if (depth > 12 || left <= 0) return v;
    if (typeof v === 'string') {
      if (!isMediaLink(key, v, parent)) return v;
      try { if (new URL(v).host === ownHost) return v; } catch { return v; }
      left--;
      return `${base}/media/${tokenFor(v)}`;
    }
    if (Array.isArray(v)) return v.map(x => walk(x, key, null, depth + 1));
    if (v && typeof v === 'object') {
      const out = {};
      for (const [k, x] of Object.entries(v)) out[k] = walk(x, k, v, depth + 1);
      return out;
    }
    return v;
  };
  return walk(body, null, null, 0);
}

// ---------------------------------------------------------------- opening a link
const idPrefix = url => crypto.createHash('sha256').update(url).digest('hex').slice(0, 32);

// The source answer, following redirects only to public hosts. Returns the fetch Response.
async function fetchSource(href) {
  let url = new URL(href);
  for (let hop = 0; hop < 5; hop++) {
    if (!/^https?:$/.test(url.protocol) || !(await publicHost(url.hostname))) throw Object.assign(new Error('blocked'), { code: 'BLOCKED' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let r;
    try { r = await fetch(url, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (YannzAPI media)', Accept: '*/*' } }); }
    catch { throw Object.assign(new Error('unreachable'), { code: 'UNREACHABLE' }); }
    finally { clearTimeout(timer); }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), url); continue; }
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { code: 'SOURCE_FAILED', status: r.status });
    return r;
  }
  throw Object.assign(new Error('too many redirects'), { code: 'SOURCE_FAILED' });
}

async function cached(prefix) {
  try {
    const row = (await query("SELECT id FROM cdn_files WHERE id LIKE $1 AND (expires_at IS NULL OR expires_at > now()) LIMIT 1", [prefix + '.%']))[0];
    return row ? cdn.fetchFile(row.id) : null;
  } catch { return null; }
}

// What /media/<token> answers with:
//   { file }   a stored file ({ mime, name, buffer, size, inline } like cdnService.fetchFile)
//   { stream } too big to store: { body, type, size } passed through from the source
//   { error }  'NOT_FOUND' (bad / forged token) or 'SOURCE_FAILED'
async function open(token) {
  const url = urlOf(token);
  if (!url) return { error: 'NOT_FOUND' };
  const prefix = idPrefix(url);
  const hit = await cached(prefix);
  if (hit && !('redirect' in hit)) return { file: hit };
  let r;
  try { r = await fetchSource(url); } catch (e) { return { error: 'SOURCE_FAILED', detail: e.code || null }; }
  const type = (r.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  const size = Number(r.headers.get('content-length') || 0);
  const name = (() => { try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || 'file'; } catch { return 'file'; } })().slice(0, 120);
  if (size > cdn.MAX_BYTES) return { stream: { body: r.body, type, size } };
  const buffer = Buffer.from(await r.arrayBuffer());
  if (!buffer.length) return { error: 'SOURCE_FAILED', detail: 'EMPTY' };
  const saved = buffer.length <= cdn.MAX_BYTES ? await keep(prefix, { buffer, type, name }).catch(() => null) : null;
  if (saved) return { file: saved };
  // Not stored (no database / too big after all): still served from here, same safety rules.
  const k = kindOf(buffer, type);
  return { file: { mime: k.inline ? k.mime : 'application/octet-stream', name, buffer, size: buffer.length, inline: k.inline } };
}

// What the file is, from its bytes and the source's content type, never from the link's name (a
// page called x.png is not a picture). Unknown kinds are served as downloads.
const kindOf = (buffer, type) => cdn.kindOf({ name: null, type, buffer });

// Stored under a fixed id (hash of the source link) so the next open finds it.
async function keep(prefix, { buffer, type, name }) {
  const k = kindOf(buffer, type);
  const id = `${prefix}.${k.ext}`;
  await query('INSERT INTO cdn_files(id, name, mime, data, size, owner_id, expires_at) VALUES($1,$2,$3,$4,$5,NULL,$6) ON CONFLICT (id) DO NOTHING',
    [id, name, k.mime, buffer.toString('base64'), buffer.length, new Date(Date.now() + STORE_DAYS * 86400000)]);
  if (Math.random() < 0.02) cdn.purgeExpired().catch(() => {});   // now and then, drop expired files
  return cdn.fetchFile(id);
}

module.exports = { rewrite, open, isMediaLink, tokenFor, urlOf, STORE_DAYS };
