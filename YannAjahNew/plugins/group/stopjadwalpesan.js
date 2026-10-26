'use strict';
const { UsageError } = require('../../library/errors');
const { A } = require('../../lib/group-activity');

module.exports = A({ id: 'group.stopjadwalpesan', name: 'stopjadwalpesan', aliases: ['sjp', 'stopjadpes', 'stopschedmsg'], description: 'Hentikan jadwal pesan (nomor, default terakhir)', usage: '[nomor]',
  async run(ctx) { const l = ctx.group.scheduledMessages || []; if (!l.length) throw new UsageError('❌ Tidak ada jadwal pesan aktif.'); const i = ctx.args[0] ? Number(ctx.args[0]) - 1 : l.length - 1; if (!l[i]) throw new UsageError('Nomor tidak ada.'); l.splice(i, 1); ctx.db.touch(); await ctx.reply('✅ Jadwal pesan dihentikan.'); } });
