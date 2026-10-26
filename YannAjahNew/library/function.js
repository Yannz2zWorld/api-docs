'use strict';
// Utilitas umum (pengganti library/function.js base/V15): waktu, format, nomor, jid,
// cache TTL, semaphore, rate limiter, dan deteksi mime dari magic bytes.

const crypto = require('crypto');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function runtime(seconds = process.uptime()) {
  seconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return [d && `${d} hari`, h && `${h} jam`, m && `${m} menit`, `${s} detik`].filter(Boolean).join(', ');
}

function clockString(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60].map(v => String(v).padStart(2, '0')).join(':');
}

const isUrl = s => { try { const u = new URL(String(s).trim()); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };
const capital = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const pickRandom = list => list[crypto.randomInt(0, list.length)];
const toIDR = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const formatNumber = n => Number(n || 0).toLocaleString('id-ID');

function bytesToSize(bytes, decimals = 2) {
  bytes = Number(bytes) || 0;
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

// Normalisasi nomor ke format internasional digit saja (default kode negara 62).
// "0812-3456-789" -> "628123456789", "+62 812..." -> "62812...". null kalau tidak valid.
function normalizePhone(input, defaultCountry = '62') {
  let s = String(input || '').replace(/[^\d+]/g, '');
  if (!s) return null;
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('00')) s = s.slice(2);
  else if (s.startsWith('0')) s = defaultCountry + s.slice(1);
  s = s.replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(s) ? s : null;
}

const toJid = num => `${String(num).replace(/\D/g, '')}@s.whatsapp.net`;
const jidUser = jid => String(jid || '').split('@')[0].split(':')[0];
const isGroupJid = jid => String(jid || '').endsWith('@g.us');
const isLidJid = jid => String(jid || '').endsWith('@lid');

function parseMention(text = '') {
  return [...String(text).matchAll(/@(\d{5,16})/g)].map(v => v[1] + '@s.whatsapp.net');
}

function truncate(text, max = 4000) {
  text = String(text ?? '');
  return text.length > max ? text.slice(0, max - 15) + '\n…(dipotong)' : text;
}

// Cache sederhana dengan TTL dan batas jumlah entri (LRU kasar).
class TTLCache {
  constructor({ ttlMs = 60000, max = 500 } = {}) { this.ttl = ttlMs; this.max = max; this.map = new Map(); }
  get(key) {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.exp < Date.now()) { this.map.delete(key); return undefined; }
    this.map.delete(key); this.map.set(key, e);
    return e.value;
  }
  has(key) { return this.get(key) !== undefined; }
  set(key, value, ttlMs = this.ttl) {
    this.map.delete(key);
    this.map.set(key, { value, exp: Date.now() + ttlMs });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
    return value;
  }
  delete(key) { return this.map.delete(key); }
  clear() { this.map.clear(); }
  get size() { return this.map.size; }
}

// Batas jumlah pekerjaan paralel.
class Semaphore {
  constructor(max = 4) { this.max = max; this.active = 0; this.queue = []; }
  async acquire() {
    if (this.active < this.max) { this.active++; return; }
    await new Promise(r => this.queue.push(r));
    this.active++;
  }
  release() { this.active--; const next = this.queue.shift(); if (next) next(); }
  async run(fn) { await this.acquire(); try { return await fn(); } finally { this.release(); } }
}

// Sliding window: maksimal `limit` kejadian per `windowMs` untuk tiap key.
class RateLimiter {
  constructor({ limit = 60, windowMs = 60000 } = {}) { this.limit = limit; this.windowMs = windowMs; this.hits = new Map(); }
  check(key = 'global') {
    const now = Date.now();
    const list = (this.hits.get(key) || []).filter(t => now - t < this.windowMs);
    if (list.length >= this.limit) { this.hits.set(key, list); return { allowed: false, retryAfterMs: this.windowMs - (now - list[0]) }; }
    list.push(now); this.hits.set(key, list);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.length || now - v[v.length - 1] > this.windowMs) this.hits.delete(k);
    return { allowed: true, remaining: this.limit - list.length };
  }
  reset(key) { key ? this.hits.delete(key) : this.hits.clear(); }
}

// Deteksi tipe file dari magic bytes (cukup untuk media yang dikirim bot).
function sniffMime(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return null;
  const hex = buf.subarray(0, 16).toString('hex');
  const ascii = buf.subarray(0, 16).toString('latin1');
  if (hex.startsWith('ffd8ff')) return { mime: 'image/jpeg', ext: 'jpg' };
  if (hex.startsWith('89504e47')) return { mime: 'image/png', ext: 'png' };
  if (ascii.startsWith('GIF8')) return { mime: 'image/gif', ext: 'gif' };
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE') return { mime: 'audio/wav', ext: 'wav' };
  if (ascii.slice(4, 8) === 'ftyp') {
    const brand = ascii.slice(8, 12);
    if (/^(M4A |M4B )/.test(brand)) return { mime: 'audio/mp4', ext: 'm4a' };
    return { mime: 'video/mp4', ext: 'mp4' };
  }
  if (hex.startsWith('1a45dfa3')) return { mime: 'video/webm', ext: 'webm' };
  if (ascii.startsWith('OggS')) return { mime: 'audio/ogg', ext: 'ogg' };
  if (ascii.startsWith('ID3') || hex.startsWith('fffb') || hex.startsWith('fff3') || hex.startsWith('fff2')) return { mime: 'audio/mpeg', ext: 'mp3' };
  if (ascii.startsWith('fLaC')) return { mime: 'audio/flac', ext: 'flac' };
  if (ascii.startsWith('%PDF')) return { mime: 'application/pdf', ext: 'pdf' };
  if (hex.startsWith('504b0304')) return { mime: 'application/zip', ext: 'zip' };
  if (ascii.startsWith('BM')) return { mime: 'image/bmp', ext: 'bmp' };
  return null;
}

function mediaKind(mime = '') {
  mime = String(mime).toLowerCase();
  if (mime === 'image/webp') return 'sticker';
  if (mime.startsWith('image/gif')) return 'gif';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

module.exports = {
  sleep, runtime, clockString, isUrl, capital, pickRandom, toIDR, formatNumber, bytesToSize,
  normalizePhone, toJid, jidUser, isGroupJid, isLidJid, parseMention, truncate,
  TTLCache, Semaphore, RateLimiter, sniffMime, mediaKind, sha256, randomToken
};
