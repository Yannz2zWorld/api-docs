'use strict';
const { feature } = require('../../library/plugin-kit');

module.exports = feature({ id: 'user.jumlahuser', name: 'jumlahuser', aliases: ['totaluser'], category: 'info', description: 'Jumlah user bot',
  async run(ctx) { const u = Object.values(ctx.db.raw().users); await ctx.reply(`📊 *TOTAL PENGGUNA*\n👥 Tercatat: ${u.length} user\n📝 Terdaftar: ${u.filter(x => x.registered).length} user\n💎 Premium: ${u.filter(x => x.premiumUntil > Date.now()).length} user`); } });
