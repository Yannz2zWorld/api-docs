'use strict';
// ----------------------------------------------------------------- absen harian
const scheduler = require('../../library/scheduler');
const { A } = require('../../lib/group-activity');

module.exports = A({ id: 'group.autoabsen', name: 'autoabsen', description: 'Kirim poll absen otomatis setiap hari (jam default 07:00)', usage: 'on/off',
  async run(ctx) {
    const v = (ctx.args[0] || '').toLowerCase(); const a = ctx.group.autoAbsen = ctx.group.autoAbsen || { enabled: false, time: '07:00', lastSent: '' };
    if (!['on', 'off'].includes(v)) return ctx.reply(`📋 Auto absen: *${a.enabled ? `ON jam ${a.time}` : 'OFF'}*\n${ctx.prefix}autoabsen on/off\n${ctx.prefix}setabsen HH:MM`);
    a.enabled = v === 'on'; ctx.db.touch(); scheduler.start(ctx.yannajah, ctx.config);
    await ctx.reply(a.enabled ? `✅ Auto absen aktif. Poll dikirim setiap hari jam ${a.time} (${ctx.config.bot.timezone}).` : '✅ Auto absen dimatikan.');
  } });
