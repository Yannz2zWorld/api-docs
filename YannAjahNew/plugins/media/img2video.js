'use strict';
// Gambar jadi video pendek efek zoom (V15: .luma / .img2video / .image2video). Premium. Lokal (ffmpeg).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { imageToVideo } = require('../../library/converter');

module.exports = feature({
  id: 'media.img2video', name: 'img2video', aliases: ['luma', 'image2video'], category: 'media', permission: 'premium', cooldown: 15, limit: 1,
  description: 'Ubah gambar jadi video pendek (efek zoom)', usage: '(reply gambar) [zoom-in|zoom-out]',
  dependencies: { bins: ['ffmpeg'] },
  async run(ctx) {
    const md = ctx.media();
    if (!md || !/^image\//.test(md.mime)) throw new UsageError('Reply gambar dengan caption .img2video');
    await ctx.react('⏳');
    await ctx.reply(ctx.config.mess.wait);
    const motion = /out/i.test(ctx.text || '') ? 'zoom-out' : 'zoom-in';
    const out = await imageToVideo(await md.download(), { motion });
    await ctx.sendFile({ buffer: out, mime: 'video/mp4' }, { caption: `🎬 Image → Video (${motion})` });
  }
});
