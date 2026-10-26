'use strict';
const { feature } = require('../../library/plugin-kit');
const { searchTiktok, pick } = require('../../lib/tiktokplay');

module.exports = feature({ id: 'downloader.ptv', name: 'ptv', category: 'downloader', description: 'Cari video TikTok lalu kirim sebagai video bulat (PTV)', usage: '<kata kunci>', cooldown: 8, limit: 1,
  dependencies: { apiz2z: '/api/search/tiktok' },
  async run(ctx) { await ctx.react('⏳'); const v = pick(await searchTiktok(ctx, ctx.text), false); await ctx.sendFile(v.url, { ptv: true }); await ctx.react('✅'); } });
