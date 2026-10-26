'use strict';
// NGL generator (V15: .ngl / .nglgenerator) — bikin gambar gaya pesan NGL. API: api.taka.my.id (tanpa key).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

module.exports = feature({
  id: 'ai.nglgenerator', name: 'nglgenerator', aliases: ['ngl'], category: 'ai', cooldown: 5, limit: 1,
  description: 'Bikin gambar gaya pesan NGL dari teks', usage: '<teks>',
  params: [{ name: 'text', required: true }], dependencies: { apis: ['taka'] },
  async run(ctx) {
    const text = (ctx.text || ctx.m.quoted?.text || '').trim();
    if (!text) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} kamu lucu banget`);
    await ctx.react('⏳');
    await ctx.sendFile(`${ctx.config.extapi.taka}/ngl?text=${encodeURIComponent(text)}`, { caption: ctx.config.mess.done });
  }
});
