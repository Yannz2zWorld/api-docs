'use strict';
const { UsageError } = require('../../library/errors');
const media = require('../../library/mediastore');
const { A, findItem, store } = require('../../lib/store');

module.exports = A({ id: 'store.dellist', name: 'dellist', description: 'Hapus item list (nama atau nomor urut)', usage: '<nama|nomor>',
  async run(ctx) {
    const s = store(ctx); const i = findItem(s.items, ctx.requireText());
    if (i < 0) throw new UsageError(`❌ Item "${ctx.text}" tidak ditemukan`);
    const [it] = s.items.splice(i, 1); ctx.db.touch(); media.release(it.media?.name, ctx.db);
    await ctx.reply(`✅ Item "${it.name}" berhasil dihapus!`);
  } });
