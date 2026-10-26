'use strict';
const converter = require('../../library/converter');
const { M, needMedia } = require('../../lib/audio');

module.exports = M({ id: 'media.togif', name: 'togif', description: 'Ubah video (maks 8 detik) jadi GIF', async run(ctx) { const buf = await needMedia(ctx, /^video\/|image\/webp/, 'video/stiker animasi'); const gif = await converter.toGif(buf); await ctx.sendFile({ buffer: await converter.toMp4(gif), mime: 'video/mp4' }, { gif: true, caption: 'GIF' }); } });
