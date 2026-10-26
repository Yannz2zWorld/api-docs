'use strict';
// Perjelas video ke 720p (V15: .hdvideo / .hdvid). Premium. Lokal (ffmpeg) — berat, antre 1 proses.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { videoHD } = require('../../library/converter');

module.exports = feature({
  id: 'media.hdvideo', name: 'hdvideo', aliases: ['hdvid'], category: 'media', permission: 'premium', cooldown: 15, limit: 1,
  description: 'Upscale video ke 720p + penajaman', usage: '(reply video)',
  dependencies: { bins: ['ffmpeg'] },
  async run(ctx) {
    const md = ctx.media();
    if (!md || !/video/.test(md.mime)) throw new UsageError('Kirim/reply video dengan caption .hdvideo');
    await ctx.react('⏳');
    await ctx.reply(ctx.config.mess.wait);
    const out = await videoHD(await md.download());
    await ctx.sendFile({ buffer: out, mime: 'video/mp4' }, { caption: '✅ Video 720p (Lanczos + sharpen)' });
  }
});
