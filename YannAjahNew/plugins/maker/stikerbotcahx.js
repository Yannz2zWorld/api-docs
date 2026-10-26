'use strict';
// Stiker karakter dari BotcahX (V15: .tvstiker/.stikergojo/.stikeranime/dll). Butuh BOTCAHX_API_KEY.
// Satu file = beberapa command (alias), endpoint berbeda per nama. Kalau key kosong → pesan jelas (tidak dihapus).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const extapi = require('../../lib/extapi');
const { sendStickerFromBuffer } = require('../../lib/stickerfetch');

// command -> [path endpoint botcahx, butuh teks?]
const MAP = {
  tvstiker: ['/api/ephoto/televisi', true],
  stikergojo: ['/api/sticker/gojosatoru', false],
  stikeranime: ['/api/sticker/anime', false],
  stikerspongebob: ['/api/sticker/spongebob', false],
  stikerpentol: ['/api/sticker/pentol', false],
  stikermukalu: ['/api/sticker/mukalu', false],
  stikerdinokuning: ['/api/sticker/dinokuning', false],
  manusialidi: ['/api/sticker/manusialidi', false],
  stikerrandom: ['/api/sticker/random', false]
};

module.exports = feature({
  id: 'maker.stikerbotcahx', name: 'tvstiker',
  aliases: ['stikergojo', 'stikeranime', 'stikerspongebob', 'stikerpentol', 'stikermukalu', 'stikerdinokuning', 'manusialidi', 'stikerrandom'],
  category: 'maker', cooldown: 5, limit: 1,
  description: 'Stiker karakter/acak dari BotcahX (tv, gojo, anime, spongebob, dll)', usage: '[teks untuk tvstiker]',
  dependencies: { apis: ['botcahx'], needsKey: 'BOTCAHX_API_KEY' },
  async run(ctx) {
    const { url, key } = ctx.config.extapi.botcahx;
    if (!key) throw new UsageError('Fitur ini butuh API BotcahX. Owner isi BOTCAHX_API_KEY di .env.');
    const [epPath, needText] = MAP[ctx.command] || MAP.tvstiker;
    let api = `${url}${epPath}?apikey=${encodeURIComponent(key)}`;
    if (needText) {
      if (!ctx.text) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} teksnya`);
      api += `&text=${encodeURIComponent(ctx.text.trim())}`;
    }
    await ctx.react('⏳');
    const { buffer } = await extapi.get(ctx, api, { as: 'buffer' });
    await sendStickerFromBuffer(ctx, buffer);
  }
});
