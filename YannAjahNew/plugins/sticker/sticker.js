'use strict';
const { UsageError } = require('../../library/errors');
const converter = require('../../library/converter');
const exif = require('../../library/exif');
const { S, meta } = require('../../lib/sticker');

module.exports = S({ id: 'sticker.make', name: 'sticker', aliases: ['s', 'stiker', 'sk'], description: 'Buat stiker dari gambar/video/GIF (video maks 8 detik). Opsional: .s pack|author', usage: '[pack|author]',
  async run(ctx) {
    const md = ctx.media();
    if (!md || !/^(image|video)\//.test(md.mime)) throw new UsageError(`Kirim/reply gambar atau video dengan caption ${ctx.prefix}s`);
    const buf = await md.download();
    const animated = /video|gif/.test(md.mime) || (md.mime === 'image/webp' && md.type === 'stickerMessage');
    const webp = md.mime === 'image/webp' ? buf : await converter.toWebpSticker(buf, { animated });
    await ctx.sendFile({ buffer: await exif.addExif(webp, meta(ctx, ctx.text)), mime: 'image/webp' });
  } });
