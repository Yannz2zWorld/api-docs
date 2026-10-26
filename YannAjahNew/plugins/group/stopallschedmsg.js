'use strict';
const { A } = require('../../lib/group-activity');

module.exports = A({ id: 'group.stopalljadwalpesan', name: 'stopallschedmsg', aliases: ['sjps', 'stopjadwalpesanall', 'stopjadwalpesansemua'], description: 'Hentikan semua jadwal pesan grup',
  async run(ctx) { const n = (ctx.group.scheduledMessages || []).length; ctx.group.scheduledMessages = []; ctx.db.touch(); await ctx.reply(`✅ ${n} jadwal pesan dihentikan.`); } });
