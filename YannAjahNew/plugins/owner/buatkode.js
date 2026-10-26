'use strict';
// ----------------------------------------------------------------- kode redeem
const { UsageError } = require('../../library/errors');
const { ITEMS, O, obj } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.buatkode', name: 'buatkode', aliases: ['addkode'], description: 'Buat kode redeem: .buatkode <KODE> <koin|limit|premium>:<jumlah> <maks klaim>', usage: '<kode> <item>:<jumlah> <maks>',
  async run(ctx) {
    const [code, it, max] = ctx.args; const [type, val] = String(it || '').split(':');
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(code || '') || !ITEMS[String(type).toLowerCase()] || !(Number(val) > 0) || !(Number(max) > 0)) throw new UsageError(`📌 *Cara Buat Kode Redeem:*\n${ctx.prefix}buatkode <kode> <item>:<jumlah> <maxklaim>\nItem: koin, limit, premium (jumlah = hari)\n\nContoh:\n${ctx.prefix}buatkode HEMAT limit:10 50\n${ctx.prefix}buatkode VIP premium:7 20`);
    const codes = obj(ctx.db.raw(), 'redeemCodes'); const k = code.toUpperCase();
    if (codes[k]) throw new UsageError('❌ Kode sudah ada.');
    codes[k] = { item: type.toLowerCase(), value: Math.min(Number(val), type.toLowerCase() === 'premium' ? 365 : 1e9), max: Math.min(Number(max), 100000), claimed: [], createdAt: Date.now() };
    ctx.db.touch(); await ctx.reply(`✅ Kode *${k}* dibuat: ${codes[k].item} ${codes[k].value}, maks ${codes[k].max} klaim.`);
  } });
