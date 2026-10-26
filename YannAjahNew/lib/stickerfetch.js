'use strict';
// Helper: ambil gambar dari URL/ext-API, ubah jadi stiker webp (512x512 + exif pack/author), lalu kirim.
const converter = require('../library/converter');
const exif = require('../library/exif');
const { meta } = require('./sticker');

async function sendStickerFromBuffer(ctx, buf, { animated = false } = {}) {
  const webp = await converter.toWebpSticker(buf, { animated });
  await ctx.sendFile({ buffer: await exif.addExif(webp, meta(ctx, ctx.text)), mime: 'image/webp' });
}

module.exports = { sendStickerFromBuffer };
