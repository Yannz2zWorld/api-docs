'use strict';
const { toIDR } = require('../../library/function');
const { U } = require('../../lib/owner-manage');

module.exports = U({ id: 'store.prem', name: 'prem', aliases: ['hargaprem', 'pricelist'], description: 'Info & harga premium / sewa bot',
  async run(ctx) {
    const s = ctx.config.sewa;
    await ctx.reply(`╭╼ *Premium Member*\n│୭ ˚.ᵎᵎ Harga : ${toIDR(ctx.config.harga.prem)}/hari\n│୭ ˚.ᵎᵎ Tanpa limit, prioritas, semua fitur\n│୭ ˚.ᵎᵎ Beli : ${ctx.prefix}buyprem <hari>\n│\n│ *Sewa Bot ke Grup*\n│୭ ˚.ᵎᵎ 1 bulan : ${toIDR(s.bulan1)}\n│୭ ˚.ᵎᵎ 3 bulan : ${toIDR(s.bulan3)}\n│୭ ˚.ᵎᵎ 6 bulan : ${toIDR(s.bulan6)}\n│୭ ˚.ᵎᵎ 12 bulan : ${toIDR(s.bulan12)}\n│୭ ˚.ᵎᵎ Sewa : ${ctx.prefix}buysewagc <link> <hari>\n╰─╼ Owner: ${ctx.config.links.owner}`);
  } });
