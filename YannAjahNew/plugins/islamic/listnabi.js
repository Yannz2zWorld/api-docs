'use strict';
const { I, NABI } = require('../../lib/islamic');

module.exports = I({ id: 'islamic.listnabi', name: 'listnabi', category: 'islamic', description: 'Daftar 25 nabi dan rasul', pure: () => NABI.map((n, i) => `${i + 1}. Nabi ${n.charAt(0).toUpperCase() + n.slice(1)}`).join('\n'), tests: [{ input: '', expect: o => o.split('\n').length === 25 }], async run(ctx) { await ctx.reply(this.pure()); } });
