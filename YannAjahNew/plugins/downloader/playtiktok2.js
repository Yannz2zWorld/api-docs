'use strict';
const { feature } = require('../../library/plugin-kit');
const { searchTiktok, pick, captionOf } = require('../../lib/tiktokplay');

module.exports = feature({ id: 'downloader.playtiktok2', name: 'playtiktok2', aliases: ['tiktokplay2', 'ptv2'], category: 'downloader', description: 'Cari & putar video TikTok acak dari hasil pencarian', usage: '<kata kunci>', cooldown: 8, limit: 1,
  dependencies: { apiz2z: '/api/search/tiktok' },
  async run(ctx) { await ctx.react('⏳'); const v = pick(await searchTiktok(ctx, ctx.text), true); await ctx.sendFile(v.url, { caption: captionOf(v) }); await ctx.react('✅'); } });
