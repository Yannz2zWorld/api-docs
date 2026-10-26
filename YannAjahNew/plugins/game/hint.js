'use strict';
const { feature } = require('../../library/plugin-kit');
const games = require('../../lib/game');
const { UsageError } = require('../../library/errors');

module.exports = feature({ id: 'game.hint', name: 'hint', aliases: ['petunjuk', 'bantuan'], category: 'game', description: 'Petunjuk untuk game tebak-tebakan yang sedang berjalan (hadiah berkurang)',
  async run(ctx) {
    const s = games.get(ctx.m.chat);
    if (!s || s.type !== 'quiz') throw new UsageError('Tidak ada game tebakan yang berjalan.');
    s.hints++; s.reward.exp = Math.max(5, Math.floor(s.reward.exp / 2)); s.reward.money = Math.max(50, Math.floor(s.reward.money / 2));
    await ctx.reply(`💡 ${games.hint(s.answer, s.hints)}`);
  } });
