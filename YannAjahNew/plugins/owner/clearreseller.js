'use strict';
const { UsageError } = require('../../library/errors');
const { O, arr } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.resellers.clear', name: 'clearreseller', aliases: ['resetreseller', 'hapussemuareseller'], description: 'Hapus semua reseller',
  async run(ctx) { const n = arr(ctx.db.raw(), 'resellers').length; if (!n) throw new UsageError('⚠️ Database reseller sudah kosong.'); ctx.db.raw().resellers = []; ctx.db.touch(); await ctx.reply(`🗑️ *BERHASIL MENGHAPUS SEMUA RESELLER!*\nTotal dihapus: *${n} user*`); } });
