'use strict';
const converter = require('../../library/converter');
const { AV, M, needMedia } = require('../../lib/audio');

module.exports = M({ id: 'media.tomp3', name: 'tomp3', aliases: ['toaudio', 'getaudio'], description: 'Ubah video/audio jadi MP3', async run(ctx) { const buf = await needMedia(ctx, AV, 'video/audio'); await ctx.sendFile({ buffer: await converter.toMp3(buf), mime: 'audio/mpeg' }, { fileName: 'audio.mp3' }); } });
