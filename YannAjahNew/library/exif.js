'use strict';
// Metadata stiker WhatsApp (exif pack/author) via node-webpmux.
const crypto = require('crypto');

async function addExif(webp, { packname = '', author = '' } = {}) {
  const { Image } = require('node-webpmux');
  const img = new Image();
  await img.load(webp);
  const json = { 'sticker-pack-id': `yannajah-${crypto.randomBytes(6).toString('hex')}`, 'sticker-pack-name': String(packname).slice(0, 60), 'sticker-pack-publisher': String(author).slice(0, 60), emojis: ['✨'] };
  const head = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
  const data = Buffer.from(JSON.stringify(json), 'utf8');
  const exif = Buffer.concat([head, data]);
  exif.writeUIntLE(data.length, 14, 4);
  img.exif = exif;
  return img.save(null);
}

async function readExif(webp) {
  const { Image } = require('node-webpmux');
  const img = new Image();
  await img.load(webp);
  if (!img.exif) return null;
  try { return JSON.parse(img.exif.subarray(22).toString('utf8')); } catch { return null; }
}

module.exports = { addExif, readExif };
