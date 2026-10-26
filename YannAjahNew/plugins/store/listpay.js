'use strict';
const { S, store } = require('../../lib/store');

module.exports = S({ id: 'store.listpay', name: 'listpay', description: 'Daftar keyword payment grup',
  async run(ctx) { const k = Object.keys(store(ctx).payments); await ctx.reply(k.length ? `📋 DAFTAR PAYMENT\n\n${k.map(x => `• ${x}`).join('\n')}\n\nTotal: ${k.length} payment` : '📭 Tidak ada payment di grup ini'); } });
