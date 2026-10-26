'use strict';
const { feature } = require('../../library/plugin-kit');
const { QUOTES, pick } = require('../../lib/fun');

module.exports = feature({ id: 'fun.quotes', name: 'motivasi', aliases: ['quotesmotivasi'], category: 'fun', description: 'Kata-kata motivasi acak', pure: () => `💬 ${pick(QUOTES)}`, tests: [{ input: '', expect: /^💬 .+/ }], async run(ctx) { await ctx.reply(this.pure()); } });
