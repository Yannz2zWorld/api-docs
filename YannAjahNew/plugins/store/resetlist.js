'use strict';
const media = require('../../library/mediastore');
const { A, store } = require('../../lib/store');

module.exports = A({ id: 'store.resetlist', name: 'resetlist', description: 'Kembalikan template .list ke bawaan',
  async run(ctx) { const s = store(ctx); const old = s.templateMedia?.name; s.template = null; s.listPrefix = null; s.templateMedia = null; ctx.db.touch(); media.release(old, ctx.db); await ctx.reply('✅ Template list berhasil direset ke default!'); } });
