'use strict';
const { I, QURAN } = require('../../lib/islamic');

module.exports = I({ id: 'islamic.listsurah', name: 'listsurah', aliases: ['daftarsurah'], category: 'islamic', description: 'Daftar 114 surah Al-Quran',
  pure: () => QURAN.map(s => `${s.number_of_surah}. ${s.name} (${s.name_translations.id}) — ${s.number_of_ayah} ayat`).join('\n'),
  tests: [{ input: '', expect: o => o.split('\n').length === 114 && o.startsWith('1. Al-Fatiha (Pembukaan) — 7 ayat') }],
  async run(ctx) { await ctx.reply(this.pure()); } });
