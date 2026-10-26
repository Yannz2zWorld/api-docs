'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { daily } = require('../../lib/fun');

module.exports = feature({ id: 'fun.rate', name: 'rate', aliases: ['nilai'], category: 'fun', description: 'Beri nilai 1-10 untuk apa saja (konsisten per hari)', usage: '<sesuatu>', pure: t => { if (!String(t || '').trim()) throw new UsageError('Apa yang mau dinilai?'); return `⭐ ${t}: *${daily('rate', String(t).toLowerCase()) % 10 + 1}/10*`; }, tests: [{ input: 'nasi goreng', expect: /^⭐ nasi goreng: \*\d+\/10\*$/ }], async run(ctx) { await ctx.reply(this.pure(ctx.text)); } });
