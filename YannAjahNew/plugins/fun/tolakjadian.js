'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { mention } = require('../../library/targets');
const { proposals } = require('../../lib/primbon');

module.exports = feature({ id: 'fun.tolakjadian', name: 'tolakjadian', category: 'fun', scope: 'group', description: 'Tolak tembakan', async run(ctx) {
  const p = proposals.get(ctx.m.sender); if (!p) throw new UsageError('❌ Tidak ada permintaan jadian untuk kamu!');
  proposals.delete(ctx.m.sender); await ctx.reply(`💔 ${mention(ctx.m.sender)} menolak ${mention(p.from)}. Yang sabar ya...`);
} });
