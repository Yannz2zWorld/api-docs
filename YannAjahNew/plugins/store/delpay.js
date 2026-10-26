'use strict';
const { UsageError } = require('../../library/errors');
const media = require('../../library/mediastore');
const { A, store } = require('../../lib/store');

module.exports = A({ id: 'store.delpay', name: 'delpay', description: 'Hapus payment grup', usage: '<keyword>',
  async run(ctx) { const s = store(ctx); const k = ctx.requireText().toLowerCase(); const v = s.payments[k]; if (!v) throw new UsageError(`❌ Payment "${k}" tidak ditemukan`); delete s.payments[k]; ctx.db.touch(); media.release(v.media?.name, ctx.db); await ctx.reply(`✅ Payment "${k}" dihapus`); } });
