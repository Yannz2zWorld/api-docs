'use strict';
const { feature } = require('../../library/plugin-kit');
const { LOREM } = require('../../lib/text-analyze');

module.exports = feature({ id: 'analyze.lorem', name: 'lorem', category: 'text', description: 'Generate teks lorem ipsum: .lorem [jumlah kata]', usage: '[jumlah kata]',
  pure: t => { const n = Math.min(Math.max(parseInt(t, 10) || 30, 1), 500); const out = Array.from({ length: n }, (_, i) => LOREM[i % LOREM.length]); out[0] = 'Lorem'; return out.join(' ') + '.'; },
  tests: [{ input: '5', expect: 'Lorem ipsum dolor sit amet.' }],
  async run(ctx) { await ctx.reply(this.pure(ctx.text)); } });
