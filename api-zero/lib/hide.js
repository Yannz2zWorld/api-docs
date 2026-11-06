'use strict';
// Menyembunyikan provider asli dari respons:
//   - field branding (creator/author/channel/...) dibuang,
//   - URL yang menunjuk ke domain provider diganti jadi link /api/media/<token> di domain kita
//     (token terenkripsi AES-256-GCM, jadi alamat aslinya nggak kebaca),
//   - teks yang menyebut nama provider diganti nama situs ini.
const crypto = require('crypto');
const PROVIDERS = require('./providers');

const DOMAINS = Object.values(PROVIDERS).map(p => new URL(p.base).hostname.replace(/^api\./, ''));
const NAMES = /\b(dongtube|botcahx|theresav|nexray|api-faa|faa api)\b/gi;
const SITE = () => process.env.SITE_NAME || 'API Zero';

function secret() {
  const base = process.env.APP_SECRET || ['api-zero', ...Object.values(PROVIDERS).map(p => (p.keyEnv && process.env[p.keyEnv]) || '')].join('|');
  return crypto.createHash('sha256').update(base).digest();
}
const isProviderHost = host => DOMAINS.some(d => host === d || host.endsWith('.' + d));

function seal(url) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', secret(), iv);
  const body = Buffer.concat([c.update(url, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url');
}
function unseal(token) {
  try {
    const raw = Buffer.from(String(token).replace(/\.[a-z0-9]{1,5}$/i, ''), 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', secret(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  } catch { return null; }
}

const EXT = /\.(jpe?g|png|gif|webp|bmp|svg|mp4|webm|mov|mkv|mp3|m4a|ogg|opus|wav|aac|flac|pdf|zip|apk|txt|json)(?=$|\?)/i;
function mediaLink(origin, href) {
  const ext = (new URL(href).pathname.match(EXT) || [])[0] || '';
  return `${origin}/api/media/${seal(href)}${ext.toLowerCase()}`;
}

function cleanString(origin, s) {
  const out = s.replace(/https?:\/\/[^\s"'<>]+/g, m => {
    try { const u = new URL(m); return isProviderHost(u.hostname) ? mediaLink(origin, u.href) : m; } catch { return m; }
  });
  return out.replace(NAMES, SITE());
}

function clean(origin, value, strip, depth = 0) {
  if (depth > 40) return value;
  if (typeof value === 'string') return cleanString(origin, value);
  if (Array.isArray(value)) return value.map(v => clean(origin, v, strip, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (strip.has(k.toLowerCase())) continue;
      out[k] = clean(origin, v, strip, depth + 1);
    }
    return out;
  }
  return value;
}

module.exports = { clean, unseal, isProviderHost, cleanString };
