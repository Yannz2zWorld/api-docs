'use strict';
const converter = require('../../library/converter');
const { M, needMedia } = require('../../lib/audio');

module.exports = M({ id: 'media.tovideo', name: 'tovideo', aliases: ['tomp4'], description: 'Ubah stiker animasi/GIF jadi video MP4', async run(ctx) { const buf = await needMedia(ctx, /image\/(webp|gif)|video\//, 'stiker animasi/GIF'); await ctx.sendFile({ buffer: await converter.toMp4(buf), mime: 'video/mp4' }); } });
