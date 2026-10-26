'use strict';
const { UsageError } = require('../../library/errors');
const converter = require('../../library/converter');
const { AV, M, needMedia } = require('../../lib/audio');

module.exports = M({ id: 'media.trim', name: 'potongaudio', aliases: ['trimaudio', 'cut'], description: 'Potong audio: .potongaudio <mulai detik> <durasi detik>', usage: '<mulai> <durasi>', async run(ctx) { const [s, d] = ctx.args.map(Number); if (!(s >= 0 && d > 0)) throw new UsageError(ctx.usage()); const buf = await needMedia(ctx, AV, 'audio/video'); await ctx.sendFile({ buffer: await converter.trimAudio(buf, s, d), mime: 'audio/mpeg' }); } });
