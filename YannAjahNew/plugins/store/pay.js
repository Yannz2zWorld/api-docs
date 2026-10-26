'use strict';
const { UsageError } = require('../../library/errors');
const { S, sendEntry, store } = require('../../lib/store');

module.exports = S({ id: 'store.pay', name: 'pay', aliases: ['payment'], description: 'Tampilkan semua metode pembayaran grup',
  async run(ctx) {
    const pays = Object.entries(store(ctx).payments);
    if (!pays.length) {
      const p = ctx.config.payment;
      const lines = [p.dana && `💳 *DANA*: ${p.dana}`, p.gopay && `💳 *GOPAY*: ${p.gopay}`].filter(Boolean);
      if (!lines.length && !p.qris) throw new UsageError(`📭 Belum ada payment. Admin: ${ctx.prefix}addpay dana|...`);
      return p.qris ? ctx.sendFile(p.qris, { caption: `💰 *PAYMENT*\n\n${lines.join('\n') || 'Scan QRIS di atas.'}` }) : ctx.reply(`💰 *PAYMENT*\n\n${lines.join('\n')}`);
    }
    for (const [, v] of pays) await sendEntry(ctx, v, v.text);
  } });
