'use strict';
const { feature } = require('../../library/plugin-kit');
const { targetJid, mention } = require('../../library/targets');
const { coupleOf } = require('../../lib/primbon');

module.exports = feature({ id: 'fun.cekpasangan', name: 'cekpasangan', aliases: ['mypasangan'], category: 'fun', description: 'Cek pasangan (kamu atau @user)', async run(ctx) {
  const j = targetJid(ctx, { self: true }); const c = coupleOf(ctx, j);
  await ctx.reply(c ? `💞 ${mention(j)} berpasangan dengan ${mention(c.partner)} sejak ${Math.floor((Date.now() - c.since) / 86400000)} hari lalu.` : `💔 ${mention(j)} masih jomblo.`);
} });
