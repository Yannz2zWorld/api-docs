'use strict';
const { feature } = require('../../library/plugin-kit');

module.exports = feature({ id: 'core.ping', name: 'ping', aliases: ['p'], category: 'core', description: 'Cek respons bot', allowInMaintenance: true,
  async run(ctx) { const t = Date.now(); await ctx.reply(`🏓 Pong! ${Date.now() - Number(ctx.m.timestamp ? ctx.m.timestamp * 1000 : t)} ms`); } });
