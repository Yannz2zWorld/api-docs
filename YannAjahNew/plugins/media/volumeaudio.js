'use strict';
const { UsageError } = require('../../library/errors');
const converter = require('../../library/converter');
const { AV, M, needMedia } = require('../../lib/audio');

module.exports = M({ id: 'media.volume', name: 'volumeaudio', aliases: ['setvolume', 'vol'], description: 'Atur volume audio: .volumeaudio 1.5 (0.1 - 10)', usage: '<faktor>', async run(ctx) { const f = Number(ctx.args[0]); if (!(f > 0 && f <= 10)) throw new UsageError(ctx.usage()); const buf = await needMedia(ctx, AV, 'audio/video'); await ctx.sendFile({ buffer: await converter.setVolume(buf, f), mime: 'audio/mpeg' }); } });
