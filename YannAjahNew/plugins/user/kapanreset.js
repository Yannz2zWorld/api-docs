'use strict';
const { feature } = require('../../library/plugin-kit');

module.exports = feature({ id: 'user.kapanreset', name: 'kapanreset', category: 'user', description: 'Kapan limit harian di-reset',
  async run(ctx) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: ctx.config.bot.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
    const s = 86400 - (Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second));
    await ctx.reply(`🕛 *RESET LIMIT*\nLimit direset setiap hari jam *00:00* (${ctx.config.bot.timezone}).\n⏳ Reset dalam *${Math.floor(s / 3600)} jam ${Math.floor((s % 3600) / 60)} menit ${s % 60} detik*`);
  } });
