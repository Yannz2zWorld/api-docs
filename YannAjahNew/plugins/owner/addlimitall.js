'use strict';
// ----------------------------------------------------------------- limit
const { UsageError } = require('../../library/errors');
const { amountArg } = require('../../library/targets');
const { O } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.addlimitall', name: 'addlimitall', description: 'Tambah limit hari ini untuk semua user', usage: '<jumlah>',
  async run(ctx) { const n = amountArg(ctx, { max: 100000 }); if (!n) throw new UsageError(ctx.usage()); let c = 0; for (const j of Object.keys(ctx.db.raw().users)) { ctx.db.user(j).limit += n; c++; } ctx.db.touch(); await ctx.reply(`✅ +${n} limit untuk ${c} user.`); } });
