'use strict';
// .cektrx <id order>: cek status order premium/sewa (Lena AI .cektrx, untuk order manual bot ini).
// User hanya bisa melihat order miliknya; owner bisa semua. Owner tanpa ID = daftar order pending.
const { mention } = require('../../library/targets');
const { toIDR } = require('../../library/function');
const { UsageError } = require('../../library/errors');
const { U, arr, findOrder, fmtDate } = require('../../lib/owner-manage');

const STATUS = { pending: 'menunggu konfirmasi owner', paid: 'lunas / berhasil', rejected: 'ditolak owner', cancelled: 'dibatalkan' };

module.exports = U({ id: 'store.cektrx', name: 'cektrx', description: 'Cek status order premium/sewa: .cektrx <id order>', usage: '<id order>',
  params: [{ name: 'id order', required: true, description: 'contoh PREM-XXXX' }],
  async run(ctx) {
    const id = (ctx.args[0] || '').trim();
    if (!id) {
      if (!ctx.isOwner) throw new UsageError(`Format: ${ctx.prefix}cektrx <id order>\nID ada di pesan invoice saat order.`);
      const l = arr(ctx.db.raw(), 'orders').filter(o => o.status === 'pending');
      return ctx.reply(l.length ? l.map(o => `• ${o.id} — ${o.product} ${o.days} hari — ${toIDR(o.amount)} — ${mention(o.user)}`).join('\n') : 'Tidak ada order pending.');
    }
    const o = findOrder(ctx, id);
    if (!o || (!ctx.isOwner && o.user !== ctx.m.sender)) throw new UsageError(`Order *${id}* tidak ditemukan.`);
    await ctx.reply([
      '乂 *Cek Transaksi*',
      `◦ ID : ${o.id}`,
      `◦ Produk : ${o.product} ${o.days} hari`,
      `◦ Total : ${toIDR(o.amount)}`,
      `◦ Status : ${STATUS[o.status] || o.status}`,
      `◦ Dibuat : ${fmtDate(o.createdAt, ctx)}`,
      o.paidAt ? `◦ Dibayar : ${fmtDate(o.paidAt, ctx)}` : null
    ].filter(Boolean).join('\n'));
  } });
