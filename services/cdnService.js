'use strict';
// CDN: menyimpan gambar yang diunggah di Postgres (tabel cdn_files, migrasi 012) dan
// melayaninya lewat URL publik /cdn/<id>. Dipakai oleh:
//   - endpoint upload /api/tools/upload (plugin/upload.js), dan
//   - kode mana pun yang perlu mengubah file unggahan menjadi URL yang bisa di-fetch
//     server lain (lewat store()).
// Tidak ada file yang ditulis ke disk (Vercel serverless read-only).
const crypto = require('crypto');
const { query } = require('../lib/db');

const MAX_BYTES = 8 * 1024 * 1024; // sejalan dengan batas express.raw di index.js

// Deteksi jenis gambar dari magic bytes, bukan dari header yang dikirim klien.
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

// Simpan sebuah gambar. Mengembalikan { id, mime, size, expiresAt }.
// ttlHours > 0 membuat file kedaluwarsa (file sementara); default permanen.
async function store({ buffer, ownerId = null, ttlHours = 0 } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw fail('NO_FILE');
  if (buffer.length > MAX_BYTES) throw fail('FILE_TOO_LARGE');
  const kind = sniff(buffer);
  if (!kind) throw fail('NOT_IMAGE');

  const id = crypto.randomBytes(16).toString('hex') + '.' + kind.ext;
  const expiresAt = ttlHours > 0 ? new Date(Date.now() + ttlHours * 3600 * 1000) : null;
  await query(
    'INSERT INTO cdn_files(id, mime, data, size, owner_id, expires_at) VALUES($1,$2,$3,$4,$5,$6)',
    [id, kind.mime, buffer.toString('base64'), buffer.length, ownerId, expiresAt]
  );
  return { id, mime: kind.mime, size: buffer.length, expiresAt: expiresAt ? expiresAt.toISOString() : null };
}

// Ambil sebuah file untuk dilayani. Mengembalikan { mime, buffer, size } atau null
// (tidak ada / sudah kedaluwarsa — dihapus sekalian).
async function fetchFile(id) {
  if (!isValidId(id)) return null;
  const row = (await query('SELECT mime, data, size, expires_at FROM cdn_files WHERE id=$1 LIMIT 1', [id]))[0];
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    query('DELETE FROM cdn_files WHERE id=$1', [id]).catch(() => {});
    return null;
  }
  return { mime: String(row.mime), buffer: Buffer.from(String(row.data), 'base64'), size: Number(row.size) };
}

// Hapus semua file yang sudah kedaluwarsa (best effort). Mengembalikan jumlah terhapus.
async function purgeExpired() {
  try {
    const rows = await query('DELETE FROM cdn_files WHERE expires_at IS NOT NULL AND expires_at < now() RETURNING id');
    return rows.length;
  } catch { return 0; }
}

function isValidId(id) { return typeof id === 'string' && /^[a-f0-9]{32}\.(png|jpe?g|webp|gif|bmp)$/i.test(id); }

// URL publik absolut untuk sebuah id. Pakai PUBLIC_BASE_URL kalau diset, selain itu
// dibangun dari request (proto + host).
function absoluteUrl(req, id) {
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '') ||
    `${(req && req.protocol) || 'https'}://${(req && req.get && req.get('host')) || 'localhost'}`;
  return `${base}/cdn/${id}`;
}

module.exports = { store, fetchFile, purgeExpired, absoluteUrl, isValidId, sniff, MAX_BYTES };
