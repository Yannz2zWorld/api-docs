'use strict';
const DATA = require('../../data/v15/fun.json');
const { F, pick } = require('../../lib/primbon');

module.exports = F({ id: 'fun.profesiku', name: 'profesiku', usage: '[nama]', description: 'Ramalan profesi masa depan',
  async run(ctx) { await ctx.reply(`💼 *Ramalan Profesi Masa Depan*\n\n*Nama:* ${ctx.text || ctx.m.pushName}\n*Prediksi Profesi Anda:* *${pick(DATA.profesiku)}*\n\n_Mulai siapkan CV dari sekarang!_`); } });
