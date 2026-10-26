'use strict';
const { O, targetNumber } = require('../../lib/owner');

module.exports = O({ id: 'owner.delowner', name: 'delowner', aliases: ['delown'], description: 'Hapus owner tambahan', usage: '<nomor/@tag>',
  async run(ctx) { const n = targetNumber(ctx); const list = ctx.db.raw().owners; const i = list.indexOf(n); if (i < 0) return ctx.reply('Nomor itu bukan owner tambahan (owner utama diatur di settingsbot.js).'); list.splice(i, 1); ctx.db.touch(); await ctx.reply(`✅ ${n} dihapus dari owner.`); } });
