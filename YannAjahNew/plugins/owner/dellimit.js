'use strict';
const { UsageError } = require('../../library/errors');
const { targetJid, mention } = require('../../library/targets');
const { O } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.dellimit', name: 'dellimit', description: 'Hapus limit harian permanen user', usage: '<@tag>',
  async run(ctx) { const j = targetJid(ctx); const u = ctx.db.user(j); if (!u.dailyLimit) throw new UsageError(`❌ ${mention(j)} tidak punya limit permanen.`); delete u.dailyLimit; ctx.db.touch(); await ctx.reply(`✅ Limit permanen ${mention(j)} dihapus.`); } });
