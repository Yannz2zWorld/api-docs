'use strict';
// ----------------------------------------------------------------- testimoni & donasi
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { now, testimoniCard } = require('../../lib/store');

module.exports = feature({ id: 'store.testimoni', name: 'testimoni', aliases: ['testi'], category: 'store', limit: 1, cooldown: 10, description: 'Buat kartu testimoni: .testimoni nama|produk|harga', usage: '<nama>|<produk>|<harga>',
  async run(ctx) {
    const [nama, produk, harga] = ctx.requireText().split('|').map(x => x?.trim());
    if (!nama || !produk || !harga) throw new UsageError(`Format: ${ctx.prefix}testimoni Budi|Premium Bot|Rp5.000`);
    const t = now(ctx.config.bot.timezone);
    const img = await testimoniCard({ nama: nama.slice(0, 60), produk: produk.slice(0, 80), harga: harga.slice(0, 40), tanggal: t.full, toko: ctx.config.bot.name });
    await ctx.sendFile({ buffer: img, mime: 'image/png' }, { caption: `✅ Testimoni ${nama}` });
  },
  _card: testimoniCard });
