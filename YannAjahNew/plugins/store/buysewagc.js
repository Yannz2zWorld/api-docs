'use strict';
const { UsageError } = require('../../library/errors');
const { amountArg } = require('../../library/targets');
const { toIDR } = require('../../library/function');
const { LINK_RE, U, newOrder, sendInvoice } = require('../../lib/owner-manage');

module.exports = U({ id: 'store.buysewagc', name: 'buysewagc', description: 'Sewa bot untuk grup (order dikonfirmasi owner): .buysewagc <link grup> <hari 7-365>', usage: '<link> <hari>', cooldown: 10,
  async run(ctx) {
    const link = LINK_RE.exec(ctx.text || ''); const days = amountArg(ctx, { min: 7, max: 365 });
    if (!link || !days) throw new UsageError(`Format: ${ctx.prefix}buysewagc https://chat.whatsapp.com/xxxx 7\nMin 7 hari, maks 365. Harga ${toIDR(ctx.config.harga.sewa)}/hari`);
    await sendInvoice(ctx, newOrder(ctx, 'sewa', days, { link: link[0] }), `Sewa Bot ${days} Hari`);
  } });
