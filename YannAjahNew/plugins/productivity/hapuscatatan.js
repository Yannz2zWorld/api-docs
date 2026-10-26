'use strict';
const { UsageError } = require('../../library/errors');
const { P, list } = require('../../lib/productivity');

module.exports = P({ id: 'productivity.note.del', name: 'hapuscatatan', aliases: ['delnote'], description: 'Hapus catatan: .hapuscatatan <nomor|semua>', usage: '<nomor|semua>',
  async run(ctx) { const n = list(ctx, 'notes'); if (ctx.text === 'semua') { ctx.user.notes = []; } else { const i = Number(ctx.text) - 1; if (!n[i]) throw new UsageError('Nomor catatan tidak ada.'); n.splice(i, 1); } ctx.db.touch(); await ctx.reply('🗑️ Dihapus.'); } });
