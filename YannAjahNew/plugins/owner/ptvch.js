'use strict';
const { UsageError } = require('../../library/errors');
const { O } = require('../../lib/owner');
const { searchTiktok, pick } = require('../../lib/tiktokplay');

module.exports = O({ id: 'owner.ptvch', name: 'ptvch', description: 'Cari video TikTok lalu kirim sebagai video bulat (PTV) ke saluran bot (CHANNEL_ID)', usage: '<kata kunci>', cooldown: 10,
  dependencies: { apiz2z: '/api/search/tiktok' },
  async run(ctx) {
    const ch = ctx.config.links.channelId;
    if (!/@newsletter$/.test(ch || '')) throw new UsageError('CHANNEL_ID belum diatur (settingsbot.js / .env).');
    await ctx.react('⏳');
    const v = pick(await searchTiktok(ctx, ctx.text), false);
    await ctx.yannajah.sendFile(ch, v.url, { ptv: true });
    await ctx.reply(`✅ Video dikirim ke saluran ${ctx.config.links.channelName || ch}.`);
  } });
