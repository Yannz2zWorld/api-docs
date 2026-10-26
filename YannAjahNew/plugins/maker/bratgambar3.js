'use strict';
// Brat sticker v3 (V15: .bratimg3 / .bratgambar3) via api.nekorinn.my.id (tanpa key). Hasil jadi stiker.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const extapi = require('../../lib/extapi');
const { sendStickerFromBuffer } = require('../../lib/stickerfetch');

const THEMES = ['white', 'black', 'green', 'blue', 'strike'];

module.exports = feature({
  id: 'maker.bratgambar3', name: 'bratgambar3', aliases: ['bratimg3'], category: 'maker', cooldown: 5, limit: 1,
  description: 'Brat sticker (tema warna) via nekorinn', usage: '<teks>|<tema: white/black/green/blue/strike>',
  params: [{ name: 'teks', required: true }], dependencies: { apis: ['nekorinn'] },
  async run(ctx) {
    let [teks, tema] = (ctx.text || '').split('|').map(s => s && s.trim());
    if (!teks) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} halo dunia|black\nTema: ${THEMES.join(', ')}`);
    tema = THEMES.includes((tema || '').toLowerCase()) ? tema.toLowerCase() : 'white';
    await ctx.react('⏳');
    const { buffer } = await extapi.get(ctx, `${ctx.config.extapi.nekorinn}/maker/brat?text=${encodeURIComponent(teks)}&theme=${tema}`, { as: 'buffer' });
    await sendStickerFromBuffer(ctx, buffer);
  }
});
