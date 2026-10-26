'use strict';
const { UsageError } = require('../../library/errors');
const { I, findSurah } = require('../../lib/islamic');

module.exports = I({ id: 'islamic.surahinfo', name: 'surahinfo', aliases: ['infosurah'], category: 'islamic', description: 'Info surah: nama, arti, jumlah ayat, golongan', usage: '<nomor|nama>',
  pure: t => { const s = findSurah(t); if (!s) throw new UsageError('Surah tidak ditemukan. Contoh: .surahinfo 36 atau .surahinfo yasin'); return `📖 *${s.number_of_surah}. ${s.name}* (${s.name_translations.ar})\nArti: ${s.name_translations.id}\nJumlah ayat: ${s.number_of_ayah}\nGolongan: ${s.type} (${s.place === 'Mecca' ? 'Makkah' : 'Madinah'})`; },
  tests: [{ input: '36', expect: o => o.includes('36. Yasin') && o.includes('Jumlah ayat: 83') }, { input: 'al-ikhlas', expect: /112\./ }],
  async run(ctx) { await ctx.reply(this.pure(ctx.text)); } });
