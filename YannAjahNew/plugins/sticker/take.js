'use strict';
const { UsageError } = require('../../library/errors');
const exif = require('../../library/exif');
const { S, meta } = require('../../lib/sticker');

module.exports = S({ id: 'sticker.take', name: 'take', aliases: ['wm', 'swm', 'colong'], description: 'Ganti nama pack/author stiker: .take pack|author', usage: '<pack>|<author>',
  async run(ctx) {
    const md = ctx.media();
    if (!md || md.mime !== 'image/webp') throw new UsageError('Reply stiker yang mau diganti pack-nya.');
    if (!ctx.text) throw new UsageError(ctx.usage());
    await ctx.sendFile({ buffer: await exif.addExif(await md.download(), meta(ctx, ctx.text)), mime: 'image/webp' });
  } });
