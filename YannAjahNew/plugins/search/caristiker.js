'use strict';
// .caristiker <kata kunci>: cari sticker pack di Sticker.ly (Yann AI V15).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { callFirst } = require('../../lib/apiz2z-kit');
const { authorOf, remember, packsOf } = require('../../lib/stickerly');

module.exports = feature({
  id: 'search.caristiker', name: 'caristiker', aliases: ['caristicker'], category: 'search', limit: 1, cooldown: 5,
  description: 'Cari sticker pack Sticker.ly: .caristiker kucing, lalu .caristikerdown <nomor>',
  usage: '<kata kunci>', params: [{ name: 'kata kunci', required: true, description: 'nama pack yang dicari' }],
  dependencies: { apiz2z: '/api/search/stickerly' },
  async run(ctx) {
    const q = ctx.requireText(`Format: ${ctx.prefix}${ctx.command} <kata kunci>\nContoh: ${ctx.prefix}${ctx.command} kucing`).slice(0, 100);
    await ctx.react('⏳');
    const { result } = await callFirst(ctx, [['/api/search/stickerly', { q }], ['/api/search/stickerly-v2', { q }]]);
    const packs = packsOf(result).slice(0, 20);
    if (!packs.length) throw new UsageError('Sticker pack tidak ditemukan.');
    remember(ctx.m.chat, packs);
    const lines = packs.map((p, i) => `◦ ${i + 1}. ${String(p.name || 'Sticker Pack').slice(0, 40)} — ${authorOf(p)}${p.stickerCount ? ` (${p.stickerCount} stiker)` : ''}`);
    await ctx.reply(`乂 *Cari Stiker* : ${q}\n◦ Total pack : ${packs.length}\n\n${lines.join('\n')}\n\nDownload: ${ctx.prefix}caristikerdown <nomor>`);
    await ctx.react('✅');
  }
});
