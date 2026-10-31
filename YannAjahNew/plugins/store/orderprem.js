'use strict';
const { UsageError } = require('../../library/errors');
const { amountArg } = require('../../library/targets');
const { toIDR } = require('../../library/function');
const { U, fmtDate, newOrder, sendInvoice } = require('../../lib/owner-manage');

module.exports = U({ id: 'store.buyprem', name: 'buyprem', aliases: ['buypremium', 'beliprem', 'belipremium'], description: 'Beli premium (order dikonfirmasi owner): .buyprem <hari 7-365>', usage: '<hari>', cooldown: 10,
  async run(ctx) {
    const days = amountArg(ctx, { min: 7, max: 365 }); if (!days) throw new UsageError(`Format: ${ctx.prefix}buyprem <hari>\nMin 7 hari, maks 365 hari. Harga ${toIDR(ctx.config.harga.prem)}/hari`);
    if (ctx.isPremium && !ctx.isOwner) throw new UsageError(`Kamu sudah premium sampai ${fmtDate(ctx.user.premiumUntil, ctx)}.`);
    await sendInvoice(ctx, newOrder(ctx, 'premium', days), `Premium Bot ${days} Hari`);
  } });
