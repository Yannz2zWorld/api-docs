'use strict';
const { feature } = require('../../library/plugin-kit');
const { runtime } = require('../../library/function');

module.exports = feature({ id: 'core.runtime', name: 'runtime', aliases: ['uptime'], category: 'core', description: 'Lama bot berjalan',
  async run(ctx) { await ctx.reply(`⏱️ Aktif selama ${runtime(process.uptime())}`); } });
