'use strict';
// Stiker WhatsApp (webp 512x512 + metadata pack/author). Butuh ffmpeg dengan libwebp.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const media = require('../../library/media');

const S = f => feature({ category: 'sticker', cooldown: 5, dependencies: { bins: ['ffmpeg'] }, ...f });
const meta = (ctx, txt) => { const [p, a] = String(txt || '').split('|').map(s => s && s.trim()); return { packname: p || ctx.config.bot.packname, author: a || ctx.config.bot.author }; };

module.exports = [
  S({ id: 'sticker.make', name: 'sticker', aliases: ['s', 'stiker', 'sk'], description: 'Buat stiker dari gambar/video/GIF (video maks 8 detik). Opsional: .s pack|author', usage: '[pack|author]',
    async run(ctx) {
      const md = ctx.media();
      if (!md || !/^(image|video)\//.test(md.mime)) throw new UsageError(`Kirim/reply gambar atau video dengan caption ${ctx.prefix}s`);
      const buf = await md.download();
      const animated = /video|gif/.test(md.mime) || (md.mime === 'image/webp' && md.type === 'stickerMessage');
      const webp = md.mime === 'image/webp' ? buf : await media.toWebpSticker(buf, { animated });
      await ctx.sendFile({ buffer: await media.addExif(webp, meta(ctx, ctx.text)), mime: 'image/webp' });
    } }),
  S({ id: 'sticker.take', name: 'take', aliases: ['wm', 'swm', 'colong'], description: 'Ganti nama pack/author stiker: .take pack|author', usage: '<pack>|<author>',
    async run(ctx) {
      const md = ctx.media();
      if (!md || md.mime !== 'image/webp') throw new UsageError('Reply stiker yang mau diganti pack-nya.');
      if (!ctx.text) throw new UsageError(ctx.usage());
      await ctx.sendFile({ buffer: await media.addExif(await md.download(), meta(ctx, ctx.text)), mime: 'image/webp' });
    } }),
  S({ id: 'sticker.exif', name: 'getexif', aliases: ['infostiker'], description: 'Lihat metadata pack/author sebuah stiker',
    async run(ctx) { const md = ctx.media(); if (!md || md.mime !== 'image/webp') throw new UsageError('Reply stiker.'); const ex = await media.readExif(await md.download()); await ctx.reply(ex ? `Pack: ${ex['sticker-pack-name'] || '-'}\nAuthor: ${ex['sticker-pack-publisher'] || '-'}\nID: ${ex['sticker-pack-id'] || '-'}` : 'Stiker ini tidak punya metadata.'); } })
];
