'use strict';
const { UsageError } = require('../../library/errors');
const media = require('../../library/mediastore');
const { A, store } = require('../../lib/store');

module.exports = A({ id: 'store.clearlist', name: 'clearlist', description: 'Hapus semua item list grup ini',
  async run(ctx) {
    const s = store(ctx); const n = s.items.length;
    if (!n) throw new UsageError('❌ Tidak ada item di list untuk dibersihkan.');
    const names = s.items.map(i => i.media?.name); s.items = []; ctx.db.touch(); names.forEach(x => media.release(x, ctx.db));
    await ctx.reply(`✅ Berhasil membersihkan *${n} item* dari list grup ini!`);
  } });
