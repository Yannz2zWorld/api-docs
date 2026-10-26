'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { addPremium, fmtDate } = require('../../lib/owner-manage');

module.exports = feature({ id: 'user.trialprem', name: 'trialprem', aliases: ['trialpremium'], category: 'user', description: 'Coba premium gratis 1 hari (sekali seumur hidup)',
  async run(ctx) {
    if (ctx.user.trialUsed) throw new UsageError(`❌ *TRIAL SUDAH PERNAH DICLAIM!*\nTrial hanya bisa 1 kali.\n\n💎 Upgrade premium: ${ctx.prefix}prem`);
    if (ctx.isPremium) throw new UsageError('❌ Kamu sudah premium aktif!');
    ctx.user.trialUsed = Date.now();
    const until = addPremium(ctx, ctx.m.sender, 1);
    await ctx.reply(`🎉 *Trial premium aktif!*\nBerlaku sampai ${fmtDate(until, ctx)}`);
  } });
