'use strict';
// .caristikerdown <nomor|url>: kirim stiker dari sticker pack Sticker.ly (Yann AI V15;
// alias Lena AI: caristikerpack, stikerlypack, caristiker_get).
const { feature } = require('../../library/plugin-kit');
const { callFirst, dataOf } = require('../../lib/apiz2z-kit');
const { MAX_STICKERS, resolvePack, sendPack } = require('../../lib/stickerly');

module.exports = feature({
  id: 'downloader.caristikerdown', name: 'caristikerdown', aliases: ['caristickerdown', 'caristikerpack', 'stikerlypack', 'caristiker_get'],
  category: 'downloader', limit: 2, cooldown: 30,
  description: `Kirim stiker dari pack Sticker.ly (maks ${MAX_STICKERS}): .caristikerdown <nomor dari .caristiker | url>`,
  usage: '<nomor|url>', params: [{ name: 'nomor/url', required: true, description: 'nomor hasil .caristiker atau URL sticker.ly' }],
  dependencies: { apiz2z: '/api/download/stickerly' },
  async run(ctx) {
    const url = resolvePack(ctx);
    await ctx.react('⏳');
    const { result } = await callFirst(ctx, [['/api/download/stickerly', { url }]]);
    await sendPack(ctx, dataOf(result));
    await ctx.react('✅');
  }
});
