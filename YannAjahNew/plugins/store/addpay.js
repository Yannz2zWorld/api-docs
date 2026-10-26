'use strict';
// ----------------------------------------------------------------- payment
const { UsageError } = require('../../library/errors');
const media = require('../../library/mediastore');
const { A, store } = require('../../lib/store');

module.exports = A({ id: 'store.addpay', name: 'addpay', aliases: ['setpay'], description: 'Tambah metode bayar grup: .addpay dana|DANA 0812xxx a.n. Budi (boleh kirim/reply gambar QR)', usage: '<keyword>|<teks>',
  async run(ctx) {
    const [k, ...rest] = ctx.requireText().split('|');
    const key = k.trim().toLowerCase(); const text = rest.join('|').trim();
    if (!/^[a-z0-9 _-]{1,30}$/.test(key) || !text) throw new UsageError(`Format: ${ctx.prefix}addpay dana|DANA 0812xxxx a.n. Nama`);
    const s = store(ctx);
    if (Object.keys(s.payments).length >= 20 && !s.payments[key]) throw new UsageError('Maksimal 20 payment per grup.');
    const old = s.payments[key]?.media?.name;
    s.payments[key] = { text: text.slice(0, 2000), media: await media.fromMessage(ctx, { kinds: ['image'] }), by: ctx.m.sender, at: Date.now() };
    ctx.db.touch(); if (old) media.release(old, ctx.db);
    await ctx.reply(`✅ Payment "${key}" disimpan. Member cukup ketik *${key}* atau ${ctx.prefix}pay.`);
  } });
