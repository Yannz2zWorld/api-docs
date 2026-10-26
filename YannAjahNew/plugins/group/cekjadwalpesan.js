'use strict';
const { G } = require('../../lib/group-activity');

module.exports = G({ id: 'group.listjadwalpesan', name: 'cekjadwalpesan', aliases: ['listschedmsg'], description: 'Daftar jadwal pesan grup',
  async run(ctx) { const l = ctx.group.scheduledMessages || []; await ctx.reply(l.length ? l.map((j, i) => `${i + 1}. tiap ${j.everyMin} menit — berikutnya ${Math.max(0, Math.round((j.nextAt - Date.now()) / 60000))} menit lagi\n   ${j.text.slice(0, 60)}`).join('\n') : '📭 Tidak ada jadwal pesan.'); } });
