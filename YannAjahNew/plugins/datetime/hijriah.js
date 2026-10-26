'use strict';
const { feature } = require('../../library/plugin-kit');
const { fmtDate, parseDate } = require('../../lib/datetime');

module.exports = feature({ id: 'datetime.hijri', name: 'hijriah', aliases: ['hijri'], category: 'datetime', description: 'Tanggal Hijriah (kalender Islam, perhitungan tabular — bisa beda ±1 hari dari rukyat)', usage: '[DD-MM-YYYY]',
  pure: t => { const d = t && String(t).trim() ? parseDate(t) : new Date(); return `${fmtDate(d)}\n☪️ ${new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)}`; },
  tests: [{ input: '11-03-2024', expect: /1 Ramadan 1445/ }],
  async run(ctx) { await ctx.reply(this.pure(ctx.text)); } });
