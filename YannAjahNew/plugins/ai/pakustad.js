'use strict';
// Pak Ustad (V15: .pakustad) — bikin gambar "pak ustad bilang ...". API: api.taka.my.id (tanpa key).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

module.exports = feature({
  id: 'ai.pakustad', name: 'pakustad', category: 'ai', cooldown: 5, limit: 1,
  description: 'Gambar "pak ustad bilang begini..."', usage: '<teks>',
  params: [{ name: 'text', required: true }], dependencies: { apis: ['taka'] },
  async run(ctx) {
    const text = (ctx.text || ctx.m.quoted?.text || '').trim();
    if (!text) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} boleh gak makan sambil minum pak ustad`);
    await ctx.react('⏳');
    await ctx.sendFile(`${ctx.config.extapi.taka}/pak-ustadv2?text=${encodeURIComponent(text)}`, { caption: '🎙️ Ustad bilang begini...' });
  }
});
