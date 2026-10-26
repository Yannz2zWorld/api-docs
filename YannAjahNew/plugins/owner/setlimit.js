'use strict';
const { UsageError } = require('../../library/errors');
const { targetJid, mention } = require('../../library/targets');
const { O } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.setlimit', name: 'setlimit', description: 'Atur limit harian permanen user (0 = kembali default)', usage: '<@tag> <limit/hari>',
  async run(ctx) {
    const j = targetJid(ctx); const n = Number(ctx.args.find(a => /^\d{1,5}$/.test(a))); if (!Number.isInteger(n)) throw new UsageError(ctx.usage());
    const u = ctx.db.user(j); if (n > 0) { u.dailyLimit = n; u.limit = Math.max(u.limit, n); } else delete u.dailyLimit; ctx.db.touch();
    await ctx.reply(n > 0 ? `✅ Limit permanen ${mention(j)} menjadi *${n} limit/hari*.` : `✅ Limit ${mention(j)} kembali ke default.`);
  } });
