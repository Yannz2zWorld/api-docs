'use strict';
const { UsageError } = require('../../library/errors');
const exif = require('../../library/exif');
const { S } = require('../../lib/sticker');

module.exports = S({ id: 'sticker.exif', name: 'getexif', aliases: ['infostiker'], description: 'Lihat metadata pack/author sebuah stiker',
  async run(ctx) { const md = ctx.media(); if (!md || md.mime !== 'image/webp') throw new UsageError('Reply stiker.'); const ex = await exif.readExif(await md.download()); await ctx.reply(ex ? `Pack: ${ex['sticker-pack-name'] || '-'}\nAuthor: ${ex['sticker-pack-publisher'] || '-'}\nID: ${ex['sticker-pack-id'] || '-'}` : 'Stiker ini tidak punya metadata.'); } });
