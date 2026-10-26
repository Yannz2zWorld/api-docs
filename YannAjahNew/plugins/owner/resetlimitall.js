'use strict';
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.resetlimit', name: 'resetlimitall', description: 'Reset limit harian semua user ke nilai default',
  async run(ctx) { let n = 0; for (const u of Object.values(ctx.db.raw().users)) { u.limit = ctx.config.limit.daily; n++; } ctx.db.touch(); await ctx.reply(`✅ Limit ${n} user direset.`); } });
