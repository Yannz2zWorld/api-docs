'use strict';
const { feature } = require('../../library/plugin-kit');
const { runtime } = require('../../library/function');

module.exports = feature({ id: 'core.botinfo', name: 'botinfo', aliases: ['info'], category: 'core', description: 'Informasi bot, versi, statistik',
  async run(ctx) {
    const h = ctx.yannajah.health();
    const s = ctx.db.raw().stats;
    await ctx.reply([`*${ctx.config.bot.name}* — YannAjahNew v${ctx.config.bot.version}`, `Owner: ${ctx.config.owner.name}`, `Fitur terdaftar: ${h.features}`, `Command dijalankan: ${s.totalCommands || 0}`, `User tercatat: ${Object.keys(ctx.db.raw().users).length}`, `Grup tercatat: ${Object.keys(ctx.db.raw().groups).length}`, `Uptime: ${runtime(h.uptime_s)}`, `Memori: ${h.memory_mb} MB`, `Node: ${process.version}`].join('\n'));
  } });
