'use strict';
// Alat developer: JSON, hash, UUID, password, JWT decode, regex, URL, HTTP status, MIME, warna, chmod.
const crypto = require('crypto');
const { textTool, feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');

const T = (name, description, fn, tests, extra = {}) => textTool({ id: `dev.${name}`, name, category: 'dev', description, fn, tests, ...extra });
const parseJson = t => { try { return JSON.parse(t); } catch (e) { throw new UsageError(`JSON tidak valid: ${e.message.slice(0, 120)}`); } };
const hash = alg => t => crypto.createHash(alg).update(t, 'utf8').digest('hex');

const HTTP = { 100: 'Continue', 101: 'Switching Protocols', 200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 206: 'Partial Content', 301: 'Moved Permanently', 302: 'Found', 303: 'See Other', 304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 406: 'Not Acceptable', 408: 'Request Timeout', 409: 'Conflict', 410: 'Gone', 411: 'Length Required', 412: 'Precondition Failed', 413: 'Payload Too Large', 414: 'URI Too Long', 415: 'Unsupported Media Type', 418: "I'm a teapot", 422: 'Unprocessable Content', 425: 'Too Early', 426: 'Upgrade Required', 428: 'Precondition Required', 429: 'Too Many Requests', 431: 'Request Header Fields Too Large', 451: 'Unavailable For Legal Reasons', 500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout', 505: 'HTTP Version Not Supported', 507: 'Insufficient Storage', 511: 'Network Authentication Required' };
const MIME = { html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', xml: 'application/xml', txt: 'text/plain', csv: 'text/csv', md: 'text/markdown', pdf: 'application/pdf', zip: 'application/zip', gz: 'application/gzip', tar: 'application/x-tar', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', bmp: 'image/bmp', avif: 'image/avif', mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/opus', wav: 'audio/wav', m4a: 'audio/mp4', flac: 'audio/flac', mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', mov: 'video/quicktime', avi: 'video/x-msvideo', apk: 'application/vnd.android.package-archive', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', wasm: 'application/wasm' };

function hexToRgb(h) { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h.trim()); if (!m) return null; let s = m[1]; if (s.length === 3) s = [...s].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); }
function rgbToHsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]; }
const toHex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();

function genPassword(len) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%^&*-_=+?'];
  const all = sets.join('');
  const chars = sets.map(s => s[crypto.randomInt(0, s.length)]);
  while (chars.length < len) chars.push(all[crypto.randomInt(0, all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(0, i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}
function strength(p) {
  let pool = 0;
  if (/[a-z]/.test(p)) pool += 26; if (/[A-Z]/.test(p)) pool += 26; if (/\d/.test(p)) pool += 10; if (/[^a-zA-Z0-9]/.test(p)) pool += 33;
  const bits = Math.round(p.length * Math.log2(pool || 1));
  const common = /^(password|123456|qwerty|admin|iloveyou|sayang|bismillah)/i.test(p) || /(.)\1{3,}/.test(p);
  const level = common || bits < 40 ? 'Lemah' : bits < 60 ? 'Sedang' : bits < 80 ? 'Kuat' : 'Sangat kuat';
  return `Panjang: ${p.length}\nEntropi kira-kira: ${bits} bit\nKekuatan: *${level}*${common ? '\n⚠️ Mengandung pola umum/berulang.' : ''}`;
}

module.exports = { T, parseJson, hash, HTTP, MIME, hexToRgb, rgbToHsl, toHex, genPassword, strength };
