'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { JAWAB, pick } = require('../../lib/fun');

module.exports = feature({ id: 'fun.8ball', name: '8ball', aliases: ['magicball'], category: 'fun', description: 'Bola ajaib 8 menjawab pertanyaanmu', usage: '<pertanyaan>', pure: t => { if (!String(t || '').trim()) throw new UsageError('Tanyakan sesuatu.'); return `🎱 ${pick(JAWAB)}`; }, tests: [{ input: 'lulus?', expect: /^🎱 / }], async run(ctx) { await ctx.reply(this.pure(ctx.text)); } });
