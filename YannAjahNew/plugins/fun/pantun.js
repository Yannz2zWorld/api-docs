'use strict';
const { feature } = require('../../library/plugin-kit');
const { PANTUN, pick } = require('../../lib/fun');

module.exports = feature({ id: 'fun.pantun', name: 'pantun', category: 'fun', description: 'Pantun acak', pure: () => pick(PANTUN), tests: [{ input: '', expect: o => o.split('\n').length === 4 }], async run(ctx) { await ctx.reply(this.pure()); } });
