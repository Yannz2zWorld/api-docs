'use strict';
// CDN: menyimpan file yang diunggah (foto, video, audio, dokumen, file apa saja) di Postgres
// (tabel cdn_files, migrasi 012) dan melayaninya lewat URL publik /cdn/<id>.<ext>. Dipakai oleh:
//   - endpoint upload /api/tools/upload (plugin/upload.js) dan halaman /upload, dan
//   - endpoint yang perlu mengubah foto unggahan menjadi URL untuk server lain (store({ imagesOnly })).
// Tidak ada file yang ditulis ke disk (Vercel serverless read-only).
//
// Keamanan: file disajikan dari domain utama, jadi hanya jenis yang aman (gambar non-SVG, video,
// audio, PDF, teks biasa) yang dibuka langsung di browser. Jenis lain (HTML, SVG, JS, arsip, ...)
// disajikan sebagai unduhan application/octet-stream, dan semua respons memakai CSP sandbox +
// nosniff, supaya file unggahan tidak bisa menjalankan script di domain ini.
const crypto = require('crypto');
const { query } = require('../lib/db');

// Vercel membatasi body request dan respons di 4,5 MB; 4 MB menyisakan ruang untuk header.
const MAX_BYTES = 4 * 1024 * 1024;

// Ekstensi -> tipe MIME yang disajikan. Yang tidak ada di sini disajikan sebagai unduhan biasa.
const TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif', ico: 'image/x-icon',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogv: 'video/ogg', mkv: 'video/x-matroska', '3gp': 'video/3gpp',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', opus: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/plain', log: 'text/plain', md: 'text/plain'
};
const INLINE = new Set(Object.keys(TYPES));
const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'application/pdf': 'pdf', 'text/plain': 'txt', 'application/zip': 'zip' };

// Deteksi gambar dari magic bytes, bukan dari header yang dikirim klien.
function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { mime: 'image/png', ext: 'png' };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return { mime: 'image/gif', ext: 'gif' };
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (buf[0] === 0x42 && buf[1] === 0x4d) return { mime: 'image/bmp', ext: 'bmp' };
  return null;
}

function fail(code) { const e = new Error(code); e.code = code; return e; }

// Nama file aman untuk disimpan/ditampilkan: tanpa path, tanpa karakter kontrol, maks 120 karakter.
function cleanName(name) {
  const base = String(name || '').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f"<>|]/g, '').trim();
  return base.slice(-120) || null;
}
function extOf(name) {
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(name || '');
  return m ? m[1].toLowerCase() : null;
}

// Simpan sebuah file. Mengembalikan { id, name, mime, size, expiresAt, inline }.
//   name       : nama asli file (dipakai untuk ekstensi dan nama unduhan)
//   type       : Content-Type dari klien (cadangan kalau nama tidak punya ekstensi)
//   ttlHours   : > 0 membuat file kedaluwarsa; default permanen
//   imagesOnly : tolak selain gambar (untuk endpoint foto)
async function store({ buffer, name = null, type = null, ownerId = null, ttlHours = 0, imagesOnly = false } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw fail('NO_FILE');
  if (buffer.length > MAX_BYTES) throw fail('FILE_TOO_LARGE');
  const image = sniff(buffer);
  if (imagesOnly && !image) throw fail('NOT_IMAGE');

  const fileName = cleanName(name);
  const clientType = String(type || '').split(';')[0].trim().toLowerCase();
  const ext = image ? image.ext : (extOf(fileName) || MIME_EXT[clientType] || 'bin');
  const mime = image ? image.mime : (TYPES[ext] || 'application/octet-stream');

  const id = crypto.randomBytes(16).toString('hex') + '.' + ext;
  const expiresAt = ttlHours > 0 ? new Date(Date.now() + ttlHours * 3600 * 1000) : null;
  await query(
    'INSERT INTO cdn_files(id, name, mime, data, size, owner_id, expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [id, fileName, mime, buffer.toString('base64'), buffer.length, ownerId, expiresAt]
  );
  return { id, name: fileName, mime, size: buffer.length, expiresAt: expiresAt ? expiresAt.toISOString() : null, inline: INLINE.has(ext) };
}

// Ambil sebuah file untuk dilayani. Mengembalikan { mime, name, buffer, size, inline } atau null
// (tidak ada / sudah kedaluwarsa — dihapus sekalian).
async function fetchFile(id) {
  if (!isValidId(id)) return null;
  const row = (await query('SELECT name, mime, data, size, expires_at FROM cdn_files WHERE id=$1 LIMIT 1', [id]))[0];
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    query('DELETE FROM cdn_files WHERE id=$1', [id]).catch(() => {});
    return null;
  }
  const ext = extOf(id);
  return { mime: INLINE.has(ext) ? String(row.mime) : 'application/octet-stream', name: row.name ? String(row.name) : id, buffer: Buffer.from(String(row.data), 'base64'), size: Number(row.size), inline: INLINE.has(ext) };
}

// Hapus semua file yang sudah kedaluwarsa (best effort). Mengembalikan jumlah terhapus.
async function purgeExpired() {
  try {
    const rows = await query('DELETE FROM cdn_files WHERE expires_at IS NOT NULL AND expires_at < now() RETURNING id');
    return rows.length;
  } catch { return 0; }
}

function isValidId(id) { return typeof id === 'string' && /^[a-f0-9]{32}\.[a-z0-9]{1,10}$/.test(id); }

// URL publik absolut untuk sebuah id. Pakai PUBLIC_BASE_URL kalau diset, selain itu
// dibangun dari request (proto + host).
function absoluteUrl(req, id) {
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '') ||
    `${(req && req.protocol) || 'https'}://${(req && req.get && req.get('host')) || 'localhost'}`;
  return `${base}/cdn/${id}`;
}

module.exports = { store, fetchFile, purgeExpired, absoluteUrl, isValidId, sniff, MAX_BYTES };
