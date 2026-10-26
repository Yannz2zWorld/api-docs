'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { addPremium, fmtDate, obj } = require('../../lib/owner-manage');

module.exports = feature({ id: 'user.redeem', name: 'redeem', aliases: ['klaimkode'], category: 'user', cooldown: 5, description: 'Tukar kode redeem', usage: '<kode>',
  async run(ctx) {
    const k = (ctx.args[0] || '').toUpperCase(); const c = obj(ctx.db.raw(), 'redeemCodes')[k];
    if (!k) throw new UsageError(`📌 Cara pakai: ${ctx.prefix}redeem <kode>`);
    if (!c) throw new UsageError('❌ Kode tidak valid.');
    if (c.claimed.includes(ctx.m.sender)) throw new UsageError('❌ Kamu sudah pernah klaim kode ini.');
    if (c.claimed.length >= c.max) throw new UsageError('❌ Kuota klaim kode ini sudah habis.');
    c.claimed.push(ctx.m.sender);
    let res;
    if (c.item === 'koin') { ctx.user.money = (ctx.user.money || 0) + c.value; res = `💰 +${c.value.toLocaleString('id-ID')} koin`; }
    else if (c.item === 'limit') { ctx.user.limit += c.value; res = `🎟️ +${c.value} limit`; }
    else res = `💎 Premium sampai ${fmtDate(addPremium(ctx, ctx.m.sender, c.value), ctx)}`;
    ctx.db.touch(); await ctx.reply(`🎁 *Redeem berhasil!*\n${res}`);
  } });
