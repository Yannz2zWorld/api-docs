'use strict';
// AI realtime (V15: .airealtime) — tanya AI yang tahu waktu/tanggal sekarang. API: api-faa.my.id (tanpa key).
// Utamakan APIZ2Z untuk chat umum; fitur ini khusus karena endpoint realtime-nya ada di faa.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const extapi = require('../../lib/extapi');

module.exports = feature({
  id: 'ai.airealtime', name: 'airealtime', category: 'ai', cooldown: 5, limit: 1,
  description: 'AI realtime (paham waktu & tanggal sekarang)', usage: '<pertanyaan>',
  params: [{ name: 'text', required: true }], dependencies: { apis: ['faa'] },
  async run(ctx) {
    const text = (ctx.text || ctx.m.quoted?.text || '').trim();
    if (!text) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} jam berapa sekarang`);
    await ctx.react('⏳');
    const r = await extapi.get(ctx, `${ctx.config.extapi.faa}/faa/ai-realtime?text=${encodeURIComponent(text)}`);
    if (!r.status || !r.result) throw new UsageError('Gagal mendapatkan respons AI, coba lagi nanti.');
    await ctx.reply(String(r.result).slice(0, 4000));
  }
});
