'use strict';
const { UsageError } = require('../../library/errors');
const { U, findOrder } = require('../../lib/owner-manage');

module.exports = U({ id: 'store.bataltrx', name: 'bataltrx', aliases: ['batalkantrx'], description: 'Batalkan order kamu yang masih pending', usage: '<order id>',
  async run(ctx) { const o = findOrder(ctx, ctx.args[0]); if (!o || o.status !== 'pending') throw new UsageError('❌ Transaksi tidak ditemukan / sudah diproses.'); if (o.user !== ctx.m.sender && !ctx.isOwner) throw new UsageError('❌ Anda tidak memiliki izin untuk membatalkan transaksi ini.'); o.status = 'cancelled'; ctx.db.touch(); await ctx.reply('✅ Transaksi berhasil dibatalkan.'); } });
