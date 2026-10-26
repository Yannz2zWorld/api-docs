'use strict';
const { UsageError } = require('../../library/errors');
const converter = require('../../library/converter');
const { M, needMedia } = require('../../lib/audio');

module.exports = M({ id: 'media.volumevideo', name: 'volumevideo', aliases: ['volvid', 'volvideo'], description: 'Atur volume suara video: .volumevideo 2 (0.1 - 10)', usage: '<faktor>',
  async run(ctx) {
    const f = Number(ctx.args[0]);
    if (!(f > 0 && f <= 10)) throw new UsageError(ctx.usage());
    const buf = await needMedia(ctx, /^video\//, 'video');
    const out = await converter.ffmpeg(buf, ['-c:v', 'copy', '-af', `volume=${f}`, '-c:a', 'aac', '-b:a', '128k', '-movflags', 'faststart', '-f', 'mp4'], { outExt: 'mp4' });
    await ctx.sendFile({ buffer: out, mime: 'video/mp4' }, { caption: `🔊 Volume x${f}` });
  } });
