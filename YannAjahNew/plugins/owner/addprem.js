'use strict';
const { UsageError } = require('../../library/errors');
const { toJid } = require('../../library/function');
const { O, targetNumber } = require('../../lib/owner');

module.exports = O({ id: 'owner.addprem', name: 'addprem', aliases: ['addpremium'], description: 'Tambah premium: .addprem <nomor/@tag> <hari>', usage: '<nomor/@tag> <hari>',
  async run(ctx) {
    const n = targetNumber(ctx);
    const days = Number(ctx.args.find(a => /^\d{1,4}$/.test(a) && a !== n) || 30);
    if (days < 1 || days > 3650) throw new UsageError('Hari 1-3650.');
    const u = ctx.db.user(toJid(n));
    u.premiumUntil = Math.max(u.premiumUntil || 0, Date.now()) + days * 86400000; ctx.db.touch();
    await ctx.reply(`💎 ${n} premium sampai ${new Date(u.premiumUntil).toLocaleString('id-ID')}`);
  } });
