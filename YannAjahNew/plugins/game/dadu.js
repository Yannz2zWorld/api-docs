'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { rnd } = require('../../lib/minigame');

module.exports = feature({ id: 'game.dadu', name: 'dadu', aliases: ['dice', 'roll'], category: 'game', description: 'Lempar dadu: .dadu [jumlah dadu] [sisi]', usage: '[n] [sisi]',
  pure: t => { const [n = 1, s = 6] = String(t || '').trim().split(/\s+/).filter(Boolean).map(Number); if (!(n >= 1 && n <= 10 && s >= 2 && s <= 100)) throw new UsageError('1-10 dadu, 2-100 sisi.'); const r = Array.from({ length: n }, () => rnd(1, s)); return `🎲 ${r.join(' + ')}${n > 1 ? ` = ${r.reduce((a, b) => a + b, 0)}` : ''}`; },
  tests: [{ input: '3 6', expect: /^🎲 [1-6] \+ [1-6] \+ [1-6] = \d+$/ }],
  async run(ctx) { await ctx.reply(this.pure(ctx.text)); } });
