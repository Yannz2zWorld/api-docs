'use strict';
const converter = require('../../library/converter');
const { AV, M, needMedia } = require('../../lib/audio');

module.exports = M({ id: 'media.tovn', name: 'tovn', aliases: ['toptt', 'vn'], description: 'Ubah audio/video jadi voice note', async run(ctx) { const buf = await needMedia(ctx, AV, 'audio/video'); await ctx.sendFile({ buffer: await converter.toOpus(buf), mime: 'audio/ogg' }, { ptt: true }); } });
