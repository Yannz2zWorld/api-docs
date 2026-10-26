'use strict';
const { UsageError } = require('../../library/errors');
const { I, findSurah } = require('../../lib/islamic');

module.exports = I({ id: 'islamic.murottal', name: 'murottal', aliases: ['audiosurah', 'audiosurat'], category: 'islamic', description: 'Audio murottal satu surah (Mishary Rashid Alafasy)', usage: '<nomor|nama>', cooldown: 15, limit: 1,
  async run(ctx) { const s = findSurah(ctx.requireText()); if (!s) throw new UsageError('Surah tidak ditemukan.'); await ctx.reply(`🎧 ${s.number_of_surah}. ${s.name} — mengirim audio...`); await ctx.sendFile(s.recitation, { fileName: `${s.name}.mp3` }); } });
