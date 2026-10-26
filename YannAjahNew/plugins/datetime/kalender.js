'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { calendar } = require('../../lib/datetime');

module.exports = feature({ id: 'datetime.calendar', name: 'kalender', aliases: ['calendar'], category: 'datetime', description: 'Kalender bulan: .kalender [bulan] [tahun]', usage: '[bulan] [tahun]',
  pure: t => { const now = new Date(); const [m, y] = String(t || '').trim().split(/\s+/).map(Number); const month = m || now.getMonth() + 1, year = y || now.getFullYear(); if (month < 1 || month > 12 || year < 1 || year > 9999) throw new UsageError('Bulan 1-12, tahun 1-9999.'); return calendar(year, month); },
  tests: [{ input: '2 2024', expect: o => o.includes('Februari 2024') && o.includes(' 1  2  3') && o.includes('29') }],
  async run(ctx) { await ctx.reply(this.pure(ctx.text)); } });
