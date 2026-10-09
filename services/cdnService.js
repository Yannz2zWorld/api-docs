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
const r2 = require('../lib/r2');

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

// Jenis file dari nama/Content-Type (gambar dideteksi dari isinya kalau buffer ada).
function kindOf({ name, type, buffer }) {
  const image = buffer ? sniff(buffer) : null;
  const fileName = cleanName(name);
  const clientType = String(type || '').split(';')[0].trim().toLowerCase();
  const ext = image ? image.ext : (extOf(fileName) || MIME_EXT[clientType] || 'bin');
  const mime = image ? image.mime : (TYPES[ext] || 'application/octet-stream');
  return { image, fileName, ext, mime, inline: INLINE.has(ext) };
}
const newId = ext => crypto.randomBytes(16).toString('hex') + '.' + ext;
const expiryOf = ttlHours => (ttlHours > 0 ? new Date(Date.now() + ttlHours * 3600 * 1000) : null);
const iso = d => (d ? new Date(d).toISOString() : null);
function disposition(inline, fileName, id) {
  const enc = encodeURIComponent(fileName || id).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${enc}`;
}

// Simpan sebuah file kecil (<= 4 MB) langsung di Postgres. Mengembalikan { id, name, mime, size, expiresAt, inline }.
//   name       : nama asli file (dipakai untuk ekstensi dan nama unduhan)
//   type       : Content-Type dari klien (cadangan kalau nama tidak punya ekstensi)
//   ttlHours   : > 0 membuat file kedaluwarsa; default permanen
//   imagesOnly : tolak selain gambar (untuk endpoint foto)
async function store({ buffer, name = null, type = null, ownerId = null, ttlHours = 0, imagesOnly = false } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw fail('NO_FILE');
  if (buffer.length > MAX_BYTES) throw fail('FILE_TOO_LARGE');
  const k = kindOf({ name, type, buffer });
  if (imagesOnly && !k.image) throw fail('NOT_IMAGE');
  const id = newId(k.ext);
  const expiresAt = expiryOf(ttlHours);
  await query(
    'INSERT INTO cdn_files(id, name, mime, data, size, owner_id, expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [id, k.fileName, k.mime, buffer.toString('base64'), buffer.length, ownerId, expiresAt]
  );
  return { id, name: k.fileName, mime: k.mime, size: buffer.length, expiresAt: iso(expiresAt), inline: k.inline };
}

// ---------------------------------------------------------------- file besar lewat Cloudflare R2
// 1) startLarge: catat file (ready=false) dan beri URL PUT bertanda tangan ke browser.
// 2) browser meng-upload langsung ke R2.
// 3) finishLarge: cek objek di R2 (ada, ukuran sesuai, Content-Type sesuai) lalu ready=true.
const MAX_LARGE_BYTES = 200 * 1024 * 1024;
const accountLimitBytes = () => {
  const mb = Number(process.env.CDN_ACCOUNT_LIMIT_MB);
  return (Number.isFinite(mb) && mb >= 0 ? mb : 2048) * 1024 * 1024;   // 0 = tanpa batas
};

// Total ukuran file aktif milik akun (untuk batas per akun).
async function accountUsage(ownerId) {
  const row = (await query("SELECT COALESCE(sum(size),0)::bigint AS n FROM cdn_files WHERE owner_id=$1 AND (expires_at IS NULL OR expires_at > now())", [ownerId]))[0];
  return Number(row?.n || 0);
}
async function checkAccountRoom(ownerId, adding, isOwner) {
  const limit = accountLimitBytes();
  if (isOwner || !ownerId || limit === 0) return;
  if ((await accountUsage(ownerId)) + adding > limit) throw Object.assign(fail('ACCOUNT_STORAGE_FULL'), { limit });
}

async function startLarge({ name, type, size, ownerId, isOwner = false, ttlHours = 0 }) {
  if (!r2.isConfigured()) throw fail('R2_NOT_CONFIGURED');
  size = Number(size);
  if (!Number.isFinite(size) || size <= 0) throw fail('NO_FILE');
  if (size > MAX_LARGE_BYTES) throw fail('FILE_TOO_LARGE');
  await checkAccountRoom(ownerId, size, isOwner);
  const k = kindOf({ name, type });
  const id = newId(k.ext);
  const contentType = k.inline ? k.mime : 'application/octet-stream';
  const expiresAt = expiryOf(ttlHours);
  await query(
    "INSERT INTO cdn_files(id, name, mime, data, size, owner_id, expires_at, storage, ready) VALUES($1,$2,$3,NULL,$4,$5,$6,'r2',false)",
    [id, k.fileName, contentType, size, ownerId, expiresAt]
  );
  const put = await r2.presignPut(id, { contentType, contentDisposition: disposition(k.inline, k.fileName, id) });
  return { id, upload: put };
}

async function finishLarge({ id, ownerId }) {
  if (!isValidId(id)) throw fail('NOT_FOUND');
  const row = (await query("SELECT name, mime, size, expires_at, ready FROM cdn_files WHERE id=$1 AND owner_id=$2 AND storage='r2' LIMIT 1", [id, ownerId]))[0];
  if (!row) throw fail('NOT_FOUND');
  const ext = extOf(id);
  const result = () => ({ id, name: row.name || null, mime: String(row.mime), size: Number(row.size), expiresAt: iso(row.expires_at), inline: INLINE.has(ext) });
  if (row.ready) return result();
  const obj = await r2.head(id);
  const bad = !obj.exists ? 'UPLOAD_MISSING'
    : obj.size > MAX_LARGE_BYTES || obj.size !== Number(row.size) ? 'UPLOAD_SIZE_MISMATCH'
    : obj.contentType !== String(row.mime) ? 'UPLOAD_TYPE_MISMATCH' : null;
  if (bad) {
    if (obj.exists) await r2.remove(id);
    await query('DELETE FROM cdn_files WHERE id=$1', [id]).catch(() => {});
    throw fail(bad);
  }
  await query('UPDATE cdn_files SET ready=true, size=$2 WHERE id=$1', [id, obj.size]);
  row.size = obj.size;
  return result();
}

// ---------------------------------------------------------------- file besar lewat catbox.moe
// Tanpa R2: browser meng-upload langsung ke catbox.moe (gratis, maks 200 MB), lalu link-nya
// didaftarkan di sini supaya yang dibagikan tetap https://<domain>/cdn/<id>.<ext>. Server mengecek
// file itu benar ada di catbox dan ukurannya (permintaan Range 1 byte, tidak mengunduh isinya).
const CATBOX_URL = /^https:\/\/files\.catbox\.moe\/([a-z0-9]{4,16})\.([a-z0-9]{1,10})$/i;
const catboxEnabled = () => String(process.env.CDN_CATBOX || 'on').toLowerCase() !== 'off';

async function remoteSize(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-0', 'User-Agent': 'Mozilla/5.0 (YannzAPI)' }, redirect: 'manual', signal: controller.signal });
    try { await r.body?.cancel(); } catch {}
    if (r.status !== 200 && r.status !== 206) return null;
    const total = /\/(\d+)$/.exec(r.headers.get('content-range') || '');
    return total ? Number(total[1]) : Number(r.headers.get('content-length') || 0);
  } catch { return null; } finally { clearTimeout(timer); }
}

async function registerCatbox({ url, name, type, ownerId, isOwner = false, ttlHours = 0 }) {
  if (!catboxEnabled()) throw fail('CATBOX_DISABLED');
  const m = CATBOX_URL.exec(String(url || '').trim());
  if (!m) throw fail('INVALID_URL');
  const size = await remoteSize(m[0]);
  if (size == null || size <= 0) throw fail('UPLOAD_MISSING');
  if (size > MAX_LARGE_BYTES) throw fail('FILE_TOO_LARGE');
  await checkAccountRoom(ownerId, size, isOwner);
  const ext = m[2].toLowerCase();
  const k = kindOf({ name: name || `file.${ext}`, type });
  const id = newId(ext);
  const expiresAt = expiryOf(ttlHours);
  await query(
    "INSERT INTO cdn_files(id, name, mime, data, size, owner_id, expires_at, storage, ready, url) VALUES($1,$2,$3,NULL,$4,$5,$6,'catbox',true,$7)",
    [id, k.fileName, k.mime, size, ownerId, expiresAt, m[0]]
  );
  return { id, name: k.fileName, mime: k.mime, size, expiresAt: iso(expiresAt), inline: INLINE.has(ext) };
}

// Ambil sebuah file untuk dilayani. Mengembalikan null (tidak ada / belum selesai / kedaluwarsa —
// dihapus sekalian), { redirect } untuk file di R2/catbox, atau { mime, name, buffer, size, inline }.
async function fetchFile(id) {
  if (!isValidId(id)) return null;
  // Newest columns first; older databases (before migration 014 / 013) still work.
  const missingColumn = e => e?.code === '42703' || e?.cause?.code === '42703';
  let row;
  for (const cols of ['name, mime, data, size, expires_at, storage, ready, url', 'name, mime, data, size, expires_at, storage, ready', 'name, mime, data, size, expires_at']) {
    try { row = (await query(`SELECT ${cols} FROM cdn_files WHERE id=$1 LIMIT 1`, [id]))[0]; break; }
    catch (e) { if (!missingColumn(e)) throw e; }
  }
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    if (row.storage === 'r2') r2.remove(id).catch(() => {});
    query('DELETE FROM cdn_files WHERE id=$1', [id]).catch(() => {});
    return null;
  }
  if (row.storage === 'r2') return row.ready ? { redirect: r2.publicUrl(id) } : null;
  if (row.storage === 'catbox') return { redirect: row.url || null };
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

module.exports = { kindOf, store, startLarge, finishLarge, registerCatbox, catboxEnabled, accountUsage, fetchFile, purgeExpired, absoluteUrl, isValidId, sniff, MAX_BYTES, MAX_LARGE_BYTES, accountLimitBytes, largeEnabled: () => r2.isConfigured() };
