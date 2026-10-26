'use strict';
const { O } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.clearprem', name: 'clearprem', description: 'Bersihkan data premium yang sudah kedaluwarsa',
  async run(ctx) { let n = 0, active = 0; for (const u of Object.values(ctx.db.raw().users)) { if (u.premiumUntil && u.premiumUntil <= Date.now()) { u.premiumUntil = 0; n++; } else if (u.premiumUntil) active++; } ctx.db.touch(); await ctx.reply(`🧹 *Pembersihan Selesai!*\n\n📌 Dihapus: *${n}*\n📦 Premium aktif: *${active}*`); } });
