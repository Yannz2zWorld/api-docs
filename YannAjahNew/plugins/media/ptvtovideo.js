'use strict';
const { M, needMedia } = require('../../lib/audio');

module.exports = M({ id: 'media.ptvtovideo', name: 'ptvtovideo', aliases: ['ptvtovid'], description: 'Ubah video bulat (PTV) jadi video biasa', dependencies: {},
  async run(ctx) { const buf = await needMedia(ctx, /^video\//, 'video bulat (PTV)'); await ctx.sendFile({ buffer: buf, mime: 'video/mp4' }, { caption: '✅ Video bulat → video biasa' }); } });
