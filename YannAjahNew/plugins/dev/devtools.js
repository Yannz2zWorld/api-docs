'use strict';
// Alat developer: JSON, hash, UUID, password, JWT decode, regex, URL, HTTP status, MIME, warna, chmod.
const crypto = require('crypto');
const { textTool, feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

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

module.exports = [
  T('jsonformat', 'Rapikan (pretty print) JSON', t => JSON.stringify(parseJson(t), null, 2), [{ input: '{"a":1,"b":[1,2]}', expect: '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}' }], { aliases: ['prettyjson'] }),
  T('jsonminify', 'Minify JSON', t => JSON.stringify(parseJson(t)), [{ input: '{ "a": 1,\n "b": 2 }', expect: '{"a":1,"b":2}' }]),
  T('jsonvalidate', 'Validasi JSON', t => { try { JSON.parse(t); return '✅ JSON valid'; } catch (e) { return `❌ JSON tidak valid: ${e.message.slice(0, 150)}`; } }, [{ input: '{"a":1}', expect: '✅ JSON valid' }, { input: '{a:1}', expect: /^❌/ }]),
  T('jsonkeys', 'Daftar path key di JSON', t => { const out = []; const walk = (v, p) => { if (out.length > 200) return; if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { const q = Array.isArray(v) ? `${p}[${k}]` : p ? `${p}.${k}` : k; out.push(q); walk(x, q); } }; walk(parseJson(t), ''); return out.join('\n') || '(kosong)'; }, [{ input: '{"a":{"b":1},"c":[5]}', expect: 'a\na.b\nc\nc[0]' }]),
  T('md5', 'Hash MD5 (bukan untuk password!)', hash('md5'), [{ input: 'abc', expect: '900150983cd24fb0d6963f7d28e17f72' }]),
  T('sha1', 'Hash SHA-1', hash('sha1'), [{ input: 'abc', expect: 'a9993e364706816aba3e25717850c26c9cd0d89d' }]),
  T('sha256', 'Hash SHA-256', hash('sha256'), [{ input: 'abc', expect: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' }]),
  T('sha512', 'Hash SHA-512', hash('sha512'), [{ input: 'abc', expect: /^ddaf35a193617aba/ }]),
  T('sha3', 'Hash SHA3-256', hash('sha3-256'), [{ input: 'abc', expect: '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532' }]),
  T('hmac', 'HMAC-SHA256: .hmac kunci|pesan', t => { const i = t.indexOf('|'); if (i < 1) throw new UsageError('Format: kunci|pesan'); return crypto.createHmac('sha256', t.slice(0, i)).update(t.slice(i + 1)).digest('hex'); }, [{ input: 'key|The quick brown fox jumps over the lazy dog', expect: 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8' }], { usage: '<kunci>|<pesan>' }),
  T('jwtdecode', 'Decode payload JWT (TANPA verifikasi tanda tangan)', t => { const p = t.trim().split('.'); if (p.length !== 3) throw new UsageError('JWT harus 3 bagian dipisah titik.'); const dec = s => { try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')); } catch { throw new UsageError('Bagian JWT bukan JSON base64url.'); } }; const h = dec(p[0]), b = dec(p[1]); const exp = b.exp ? `\nexp: ${new Date(b.exp * 1000).toISOString()}${b.exp * 1000 < Date.now() ? ' (KEDALUWARSA)' : ''}` : ''; return `Header:\n${JSON.stringify(h, null, 2)}\nPayload:\n${JSON.stringify(b, null, 2)}${exp}\n⚠️ Tanda tangan TIDAK diverifikasi.`; }, [{ input: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.x', expect: o => o.includes('"sub": "123"') && o.includes('"alg": "HS256"') }]),
  T('regex', 'Uji regex: .regex pola|teks (flag opsional: /pola/gi|teks)', t => { const i = t.indexOf('|'); if (i < 1) throw new UsageError('Format: pola|teks'); let src = t.slice(0, i), flags = 'g'; const m = /^\/(.+)\/([gimsuy]*)$/.exec(src); if (m) { src = m[1]; flags = m[2].includes('g') ? m[2] : m[2] + 'g'; } if (src.length > 200) throw new UsageError('Pola maks 200 karakter.'); let re; try { re = new RegExp(src, flags); } catch (e) { throw new UsageError(`Regex tidak valid: ${e.message}`); } const text = t.slice(i + 1).slice(0, 2000); const found = [...text.matchAll(re)].slice(0, 30); return found.length ? `${found.length} cocok:\n` + found.map((x, n) => `${n + 1}. "${x[0]}" @${x.index}${x.length > 1 ? ` grup: ${JSON.stringify(x.slice(1))}` : ''}`).join('\n') : 'Tidak ada yang cocok.'; }, [{ input: '\\d+|a1b22', expect: '2 cocok:\n1. "1" @1\n2. "22" @3' }], { usage: '<pola>|<teks>' }),
  T('urlparse', 'Uraikan komponen URL', t => { let u; try { u = new URL(t.trim()); } catch { throw new UsageError('URL tidak valid.'); } return [`Protocol: ${u.protocol}`, `Host: ${u.hostname}`, `Port: ${u.port || '(default)'}`, `Path: ${u.pathname}`, `Query: ${[...u.searchParams].map(([k, v]) => `${k}=${v}`).join(', ') || '-'}`, `Hash: ${u.hash || '-'}`].join('\n'); }, [{ input: 'https://a.com:8080/x/y?q=1&r=2#top', expect: 'Protocol: https:\nHost: a.com\nPort: 8080\nPath: /x/y\nQuery: q=1, r=2\nHash: #top' }]),
  T('httpstatus', 'Arti kode status HTTP', t => { const c = Number(t.trim()); return HTTP[c] ? `${c} ${HTTP[c]}` : `Kode ${t.trim()} tidak dikenal (${c >= 100 && c < 600 ? ['', 'Informational', 'Success', 'Redirection', 'Client error', 'Server error'][Math.floor(c / 100)] : 'di luar 100-599'})`; }, [{ input: '429', expect: '429 Too Many Requests' }], { aliases: ['statuscode'] }),
  T('mimetype', 'MIME type dari ekstensi file', t => { const e = t.trim().toLowerCase().replace(/^.*\./, ''); return MIME[e] ? `.${e} → ${MIME[e]}` : `Ekstensi .${e} tidak ada di tabel.`; }, [{ input: 'foto.webp', expect: '.webp → image/webp' }], { aliases: ['mime'] }),
  T('color', 'Konversi warna HEX ↔ RGB ↔ HSL', t => { const s = t.trim(); let rgb = hexToRgb(s); if (!rgb) { const m = /^rgb\(?\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?$/i.exec(s); if (m) rgb = m.slice(1).map(Number); } if (!rgb || rgb.some(v => v > 255)) throw new UsageError('Format: #ff8800 atau rgb(255,136,0)'); const [h, sa, l] = rgbToHsl(rgb); return `HEX: ${toHex(rgb)}\nRGB: rgb(${rgb.join(', ')})\nHSL: hsl(${h}, ${sa}%, ${l}%)`; }, [{ input: '#ff8800', expect: 'HEX: #FF8800\nRGB: rgb(255, 136, 0)\nHSL: hsl(32, 100%, 50%)' }], { aliases: ['warna'] }),
  T('chmod', 'Konversi izin chmod angka ↔ simbol', t => { const s = t.trim(); if (/^[0-7]{3}$/.test(s)) return `${s} = ${[...s].map(d => ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'][d]).join('')}`; if (/^[rwx-]{9}$/.test(s)) return `${s} = ${[0, 3, 6].map(i => (s[i] === 'r' ? 4 : 0) + (s[i + 1] === 'w' ? 2 : 0) + (s[i + 2] === 'x' ? 1 : 0)).join('')}`; throw new UsageError('Format: 755 atau rwxr-xr-x'); }, [{ input: '754', expect: '754 = rwxr-xr--' }, { input: 'rw-r--r--', expect: 'rw-r--r-- = 644' }]),
  T('passwordcheck', 'Cek kekuatan password (tidak disimpan/dicatat)', strength, [{ input: 'aaaa1', expect: /Lemah/ }, { input: 'Tr0ub4dor&3xyzQ!', expect: /Sangat kuat|Kuat/ }], { aliases: ['cekpassword'], scope: 'private' }),
  feature({ id: 'dev.uuid', name: 'uuid', category: 'dev', description: 'Generate UUID v4 acak (maks 20)', usage: '[jumlah]',
    pure: t => Array.from({ length: Math.min(Math.max(parseInt(t, 10) || 1, 1), 20) }, () => crypto.randomUUID()).join('\n'),
    tests: [{ input: '2', expect: o => o.split('\n').length === 2 && o.split('\n').every(x => /^[0-9a-f-]{36}$/.test(x)) }],
    async run(ctx) { await ctx.reply(this.pure(ctx.text)); } }),
  feature({ id: 'dev.password', name: 'genpassword', aliases: ['passgen'], category: 'dev', description: 'Buat password acak kuat (8-64 karakter)', usage: '[panjang]', scope: 'private',
    pure: t => genPassword(Math.min(Math.max(parseInt(t, 10) || 16, 8), 64)),
    tests: [{ input: '20', expect: o => o.length === 20 && /[A-Z]/.test(o) && /[a-z]/.test(o) && /\d/.test(o) && /[^A-Za-z0-9]/.test(o) }],
    async run(ctx) { await ctx.reply(this.pure(ctx.text)); } }),
  feature({ id: 'dev.timestamp', name: 'timestamp', aliases: ['epoch'], category: 'dev', description: 'Unix timestamp ↔ tanggal ISO', usage: '[timestamp | tanggal ISO]',
    pure: t => { const s = String(t || '').trim(); if (!s) return `Sekarang: ${Math.floor(Date.now() / 1000)}`; if (/^\d{9,13}$/.test(s)) { const ms = s.length > 10 ? Number(s) : Number(s) * 1000; return new Date(ms).toISOString(); } const d = new Date(s); if (Number.isNaN(d.getTime())) throw new UsageError('Tanggal tidak dikenali.'); return String(Math.floor(d.getTime() / 1000)); },
    tests: [{ input: '0000000000', expect: '1970-01-01T00:00:00.000Z' }, { input: '2024-01-01T00:00:00Z', expect: '1704067200' }],
    async run(ctx) { await ctx.reply(this.pure(ctx.text)); } })
];
