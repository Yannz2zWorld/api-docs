'use strict';
const { UsageError } = require('../../library/errors');
const { P, list } = require('../../lib/productivity');

module.exports = P({ id: 'productivity.remind.del', name: 'hapusingat', aliases: ['delreminder'], description: 'Hapus pengingat', usage: '<nomor>',
  async run(ctx) { const r = list(ctx, 'reminders'); const i = Number(ctx.text) - 1; if (!r[i]) throw new UsageError('Nomor tidak ada.'); r.splice(i, 1); ctx.db.touch(); await ctx.reply('🗑️ Pengingat dihapus.'); } });
