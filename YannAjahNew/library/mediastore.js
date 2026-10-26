'use strict';
// Penyimpanan media milik fitur (gambar list, respon otomatis, template, testimoni) di
// library/database/media/. Nama file = hash isi (tidak bisa ditebak, tidak ada path dari user),
// ukuran dibatasi, dan database hanya menyimpan nama filenya.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sniffMime } = require('./function');
const { UsageError } = require('./errors');

const DIR = path.resolve(__dirname, 'database', 'media');
const MAX_BYTES = 15 * 1024 * 1024;
const NAME_RE = /^[a-f0-9]{40}\.[a-z0-9]{2,5}$/;

async function save(buffer, mime = '') {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new UsageError('Media kosong atau gagal diunduh.');
  if (buffer.length > MAX_BYTES) throw new UsageError('Media maksimal 15 MB.');
  const ext = sniffMime(buffer)?.ext || (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  const name = `${crypto.createHash('sha1').update(buffer).digest('hex')}.${ext}`;
  await fs.promises.mkdir(DIR, { recursive: true });
  const file = path.join(DIR, name);
  if (!fs.existsSync(file)) await fs.promises.writeFile(file, buffer, { mode: 0o600 });
  return name;
}

function load(name) {
  if (!name || !NAME_RE.test(name)) return null;
  const file = path.join(DIR, name);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

// Hapus hanya kalau nama itu tidak lagi dipakai di database (file dibagi berdasarkan hash isi).
function release(name, db) {
  if (!name || !NAME_RE.test(name)) return;
  if (JSON.stringify(db.raw()).includes(name)) return;
  fs.promises.rm(path.join(DIR, name), { force: true }).catch(() => {});
}

// Media dari pesan ini atau yang di-reply -> { name, kind, mime } (null kalau tidak ada media).
async function fromMessage(ctx, { kinds = ['image', 'video', 'audio', 'sticker', 'document'] } = {}) {
  const md = ctx.media();
  if (!md) return null;
  const kind = /^image\/webp/.test(md.mime) || md.type === 'stickerMessage' ? 'sticker' : (md.mime.split('/')[0] || 'document');
  const k = ['image', 'video', 'audio', 'sticker'].includes(kind) ? kind : 'document';
  if (!kinds.includes(k)) return null;
  const buf = await md.download();
  return { name: await save(buf, md.mime), kind: k, mime: md.mime };
}

// Konten pesan Baileys untuk media tersimpan.
function content(entry, caption) {
  const buf = load(entry?.name);
  if (!buf) return caption ? { text: caption } : null;
  switch (entry.kind) {
    case 'image': return { image: buf, caption };
    case 'video': return { video: buf, caption };
    case 'audio': return { audio: buf, mimetype: entry.mime || 'audio/mpeg' };
    case 'sticker': return { sticker: buf };
    default: return { document: buf, mimetype: entry.mime || 'application/octet-stream', fileName: 'file', caption };
  }
}

module.exports = { save, load, release, fromMessage, content, DIR };
