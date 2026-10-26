'use strict';
// Family 100: banyak jawaban per soal.
const { feature } = require('../../library/plugin-kit');
const games = require('../../lib/game');
const { UsageError } = require('../../library/errors');
const { load, pick } = require('../../lib/tebak');

module.exports = feature({
  id: 'game.family100', name: 'family100', category: 'game', description: `Family 100: sebutkan jawaban survei sebanyak-banyaknya (${load('family100').length} soal)`, cooldown: 5, limit: 1, dataset: 'data/game/family100.json',
  async run(ctx) {
    if (games.get(ctx.m.chat)) throw new UsageError('Masih ada game yang berjalan di chat ini.');
    const x = pick(load('family100'));
    games.start(ctx.m.chat, { type: 'family100', name: 'family100', answers: x.jawaban.map(String), found: [], reward: { exp: 10, money: 100 } }, {
      timeoutMs: 120000,
      onTimeout: s => ctx.yannajah.sendmessage(ctx.m.chat, { text: `⌛ Waktu habis!\nSemua jawaban:\n${s.answers.map((a, i) => `${i + 1}. ${a}${s.found.includes(a) ? ' ✅' : ''}`).join('\n')}` }).catch(() => {})
    });
    await ctx.reply(`🎮 *FAMILY 100*\n${x.soal}\n\nAda ${x.jawaban.length} jawaban · 120 detik · .nyerah untuk menyerah`);
  }
});
