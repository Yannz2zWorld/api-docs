'use strict';
// Ubah tempo audio (V15: .tempo). Reply audio + .tempo 0.8 (lambat) / 1.5 (cepat). Lokal (ffmpeg).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { audioTempo } = require('../../library/converter');

module.exports = feature({
  id: 'media.tempo', name: 'tempo', category: 'media', cooldown: 5, limit: 1,
  description: 'Ubah kecepatan audio 0.5x–2.0x', usage: '<0.5-2.0> (reply audio)',
  dependencies: { bins: ['ffmpeg'] },
  async run(ctx) {
    const md = ctx.media();
    if (!md || !/audio|video/.test(md.mime)) throw new UsageError(`Reply audio lalu: ${ctx.prefix}${ctx.command} 0.8`);
    const speed = parseFloat(ctx.text);
    if (!(speed >= 0.5 && speed <= 2.0)) throw new UsageError('Masukkan kecepatan 0.5 sampai 2.0. Contoh: .tempo 1.25');
    await ctx.react('⏳');
    const out = await audioTempo(await md.download(), speed);
    await ctx.sendFile({ buffer: out, mime: 'audio/mpeg' }, { fileName: `tempo-${speed}x.mp3`, caption: `✅ Kecepatan: ${speed}x` });
  }
});
