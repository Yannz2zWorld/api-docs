'use strict';
const { UsageError } = require('../../library/errors');
const { targetJid } = require('../../library/targets');
const { G } = require('../../lib/group-activity');

module.exports = G({ id: 'group.delultah', name: 'delultah', description: 'Hapus tanggal ulang tahunmu (admin: @user)', usage: '[@user]',
  async run(ctx) { const t = ctx.isAdmin || ctx.isOwner ? targetJid(ctx, { self: true }) : ctx.m.sender; if (!ctx.group.birthdays?.[t]) throw new UsageError('❌ Tidak ada data.'); delete ctx.group.birthdays[t]; ctx.db.touch(); await ctx.reply('✅ Data ulang tahun dihapus.'); } });
