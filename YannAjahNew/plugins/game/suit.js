'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { rnd } = require('../../lib/minigame');

module.exports = feature({ id: 'game.suit', name: 'suit', aliases: ['rps'], category: 'game', description: 'Suit melawan bot: .suit batu|gunting|kertas', usage: '<batu|gunting|kertas>',
  pure: (t, _ctx, botPick = ['batu', 'gunting', 'kertas'][rnd(0, 2)]) => {
    const me = String(t || '').trim().toLowerCase();
    if (!['batu', 'gunting', 'kertas'].includes(me)) throw new UsageError('Pilih batu, gunting, atau kertas.');
    const beats = { batu: 'gunting', gunting: 'kertas', kertas: 'batu' };
    const res = me === botPick ? 'Seri 🤝' : beats[me] === botPick ? 'Kamu menang 🎉' : 'Kamu kalah 😝';
    return `Kamu: ${me}\nBot: ${botPick}\n${res}`;
  },
  tests: [{ input: 'batu', expect: o => /Kamu: batu\nBot: (batu|gunting|kertas)\n(Seri|Kamu menang|Kamu kalah)/.test(o) }],
  async run(ctx) { await ctx.reply(this.pure(ctx.text)); } });
