'use strict';
const { feature } = require('../../library/plugin-kit');
const { genPassword } = require('../../lib/devtools');

module.exports = feature({ id: 'dev.password', name: 'genpassword', aliases: ['passgen'], category: 'dev', description: 'Buat password acak kuat (8-64 karakter)', usage: '[panjang]', scope: 'private',
  pure: t => genPassword(Math.min(Math.max(parseInt(t, 10) || 16, 8), 64)),
  tests: [{ input: '20', expect: o => o.length === 20 && /[A-Z]/.test(o) && /[a-z]/.test(o) && /\d/.test(o) && /[^A-Za-z0-9]/.test(o) }],
  async run(ctx) { await ctx.reply(this.pure(ctx.text)); } });
