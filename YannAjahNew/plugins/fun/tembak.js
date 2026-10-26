'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { targetJid, mention } = require('../../library/targets');
const { coupleOf, proposals } = require('../../lib/primbon');

module.exports = feature({ id: 'fun.tembak', name: 'tembak', category: 'fun', scope: 'group', description: 'Nyatakan perasaan ke @user (dia jawab .terimajadian / .tolakjadian dalam 5 menit)', usage: '@user',
  async run(ctx) {
    const t = targetJid(ctx);
    if (t === ctx.m.sender) throw new UsageError('❌ Masa nembak diri sendiri 😅');
    if (coupleOf(ctx, ctx.m.sender)) throw new UsageError(`❌ Kamu sudah punya pasangan (${mention(coupleOf(ctx, ctx.m.sender).partner)}).`);
    if (coupleOf(ctx, t)) throw new UsageError(`💔 ${mention(t)} sudah punya pasangan.`);
    proposals.set(t, { from: ctx.m.sender, chat: ctx.m.chat, at: Date.now() });
    await ctx.reply(`💘 ${mention(ctx.m.sender)} nembak ${mention(t)}!\n\n${mention(t)}, ketik *.terimajadian* atau *.tolakjadian* (5 menit).`);
  } });
