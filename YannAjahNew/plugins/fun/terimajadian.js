'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { mention } = require('../../library/targets');
const { proposals } = require('../../lib/primbon');

module.exports = feature({ id: 'fun.terimajadian', name: 'terimajadian', category: 'fun', scope: 'group', description: 'Terima tembakan', async run(ctx) {
  const p = proposals.get(ctx.m.sender);
  if (!p || Date.now() - p.at > 300000) throw new UsageError('❌ Tidak ada permintaan jadian untuk kamu!');
  proposals.delete(ctx.m.sender);
  const c = ctx.db.raw().couples = ctx.db.raw().couples || {};
  c[p.from] = { partner: ctx.m.sender, since: Date.now() }; c[ctx.m.sender] = { partner: p.from, since: Date.now() }; ctx.db.touch();
  await ctx.reply(`💞 Selamat! ${mention(p.from)} & ${mention(ctx.m.sender)} resmi jadian! 🎉`);
} });
