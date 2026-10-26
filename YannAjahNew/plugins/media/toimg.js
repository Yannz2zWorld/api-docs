'use strict';
const converter = require('../../library/converter');
const { M, needMedia } = require('../../lib/audio');

module.exports = M({ id: 'media.toimg', name: 'toimg', aliases: ['topng'], description: 'Ubah stiker jadi gambar PNG', async run(ctx) { const buf = await needMedia(ctx, /image\/webp/, 'stiker'); await ctx.sendFile({ buffer: await converter.toPng(buf), mime: 'image/png' }); } });
