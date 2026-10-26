'use strict';
const { feature } = require('../../library/plugin-kit');
const games = require('../../lib/game');
const { UsageError } = require('../../library/errors');

module.exports = feature({ id: 'game.nyerah', name: 'nyerah', aliases: ['menyerah', 'giveup'], category: 'game', description: 'Menyerah pada game yang sedang berjalan',
  async run(ctx) {
    const s = games.stop(ctx.m.chat);
    if (!s) throw new UsageError('Tidak ada game yang berjalan.');
    if (s.type === 'family100') return ctx.reply(`🏳️ Menyerah. Jawaban:\n${s.answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}`);
    await ctx.reply(`🏳️ Menyerah. Jawabannya: *${s.answer ?? s.target ?? '-'}*`);
  } });
