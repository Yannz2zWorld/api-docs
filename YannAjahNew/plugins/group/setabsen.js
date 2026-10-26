'use strict';
const { UsageError } = require('../../library/errors');
const scheduler = require('../../library/scheduler');
const { A } = require('../../lib/group-activity');

module.exports = A({ id: 'group.setabsen', name: 'setabsen', description: 'Atur jam auto absen (HH:MM, 24 jam)', usage: 'HH:MM',
  async run(ctx) {
    const t = ctx.args[0] || ''; if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(t)) throw new UsageError('❌ Format waktu salah! Gunakan HH:MM (contoh 07:00)');
    const hhmm = t.padStart(5, '0');
    ctx.group.autoAbsen = { ...(ctx.group.autoAbsen || {}), enabled: true, time: hhmm, lastSent: '' }; ctx.db.touch(); scheduler.start(ctx.yannajah, ctx.config);
    await ctx.reply(`✅ Waktu absen diatur ke: ${hhmm}\n📌 Bot kirim poll absen setiap hari jam ${hhmm}`);
  } });
