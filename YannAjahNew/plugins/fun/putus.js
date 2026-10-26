'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { mention } = require('../../library/targets');
const { coupleOf } = require('../../lib/primbon');

module.exports = feature({ id: 'fun.putus', name: 'putus', category: 'fun', description: 'Putus dengan pasangan', async run(ctx) {
  const c = coupleOf(ctx, ctx.m.sender); if (!c) throw new UsageError('Kamu belum punya pasangan.');
  delete ctx.db.raw().couples[ctx.m.sender]; delete ctx.db.raw().couples[c.partner]; ctx.db.touch();
  await ctx.reply(`💔 ${mention(ctx.m.sender)} dan ${mention(c.partner)} resmi putus.`);
} });
