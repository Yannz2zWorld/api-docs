'use strict';
const { UsageError } = require('../../library/errors');
const media = require('../../library/mediastore');
const { O, obj } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.delrespon', name: 'delrespon', description: 'Hapus respon otomatis', usage: '<kata kunci>',
  async run(ctx) { const r = obj(ctx.db.raw(), 'responses'); const k = ctx.requireText().toLowerCase().trim(); if (!r[k]) throw new UsageError(`Respon *${k}* tidak ditemukan.`); const old = r[k].media?.name; delete r[k]; ctx.db.touch(); media.release(old, ctx.db); await ctx.reply(`✅ Respon *${k}* dihapus.`); } });
