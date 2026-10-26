'use strict';
const crypto = require('crypto');
const { feature } = require('../../library/plugin-kit');

module.exports = feature({ id: 'dev.uuid', name: 'uuid', category: 'dev', description: 'Generate UUID v4 acak (maks 20)', usage: '[jumlah]',
  pure: t => Array.from({ length: Math.min(Math.max(parseInt(t, 10) || 1, 1), 20) }, () => crypto.randomUUID()).join('\n'),
  tests: [{ input: '2', expect: o => o.split('\n').length === 2 && o.split('\n').every(x => /^[0-9a-f-]{36}$/.test(x)) }],
  async run(ctx) { await ctx.reply(this.pure(ctx.text)); } });
