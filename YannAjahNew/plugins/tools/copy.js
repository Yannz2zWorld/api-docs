'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

module.exports = feature({ id: 'tools.copy', name: 'copy', aliases: ['salin'], category: 'tools', description: 'Salin teks pesan yang di-reply (nomor & link dipisah agar mudah disalin)',
  async run(ctx) {
    const t = ctx.m.quoted?.text; if (!t) throw new UsageError('⚠️ Reply pesan *teks* lalu ketik .copy');
    const blue = t.match(/(\+?628\d{8,13}|08\d{8,13}|https?:\/\/\S+)/g);
    await ctx.reply(t);
    if (blue?.length) await ctx.reply(blue.join('\n'));
  } });
