'use strict';
const { feature } = require('../../library/plugin-kit');

module.exports = feature({ id: 'store.donate', name: 'donate', aliases: ['donasi'], category: 'info', description: 'Info donasi (QRIS dari settingsbot.js)',
  async run(ctx) {
    const text = ' ╼ ׅ ֹ𔖰᷼𔖮 *DONASI*\n╭╼─┈───┈─一緒╼\n│୭ ˚.ᵎᵎ Dukung bot ini\n│୭ ˚.ᵎᵎ Jika merasa terbantu,\n│୭ ˚.ᵎᵎ pertimbangkan donasi\n╰─╼𔕬─┈───┈───┈\nScan QRIS untuk berdonasi. Terima kasih!';
    if (ctx.config.payment.qris) await ctx.sendFile(ctx.config.payment.qris, { caption: text }); else await ctx.reply(text);
  } });
