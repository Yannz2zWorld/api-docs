'use strict';
const { feature } = require('../../library/plugin-kit');
const { rnd } = require('../../lib/minigame');

module.exports = feature({ id: 'game.koin', name: 'koin', aliases: ['coinflip', 'flip'], category: 'game', description: 'Lempar koin (angka/gambar)',
  pure: () => (rnd(0, 1) ? '🪙 Angka' : '🪙 Gambar'), tests: [{ input: '', expect: /^🪙 (Angka|Gambar)$/ }],
  async run(ctx) { await ctx.reply(this.pure()); } });
