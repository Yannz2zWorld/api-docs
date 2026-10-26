'use strict';
// ----------------------------------------------------------------- jadwal pesan berulang
const { UsageError } = require('../../library/errors');
const scheduler = require('../../library/scheduler');
const { A } = require('../../lib/group-activity');

module.exports = A({ id: 'group.jadwalpesan', name: 'jadwalpesan', aliases: ['jadpes', 'schedmsg'], description: 'Kirim pesan berulang tiap N menit: .jadwalpesan 60 | Jangan lupa absen!', usage: '<menit> | <pesan>',
  async run(ctx) {
    const [a, ...rest] = ctx.requireText().split('|'); const every = Number(a); const text = rest.join('|').trim();
    if (!(every >= 5 && every <= 10080) || !text) throw new UsageError('Format: .jadwalpesan <menit 5-10080> | <pesan>');
    const l = ctx.group.scheduledMessages = ctx.group.scheduledMessages || [];
    if (l.length >= 5) throw new UsageError('Maksimal 5 jadwal pesan per grup.');
    l.push({ everyMin: every, text: text.slice(0, 2000), nextAt: Date.now() + every * 60000, by: ctx.m.sender }); ctx.db.touch(); scheduler.start(ctx.yannajah, ctx.config);
    await ctx.reply(`✅ Pesan dijadwalkan setiap ${every} menit (#${l.length}).`);
  } });
