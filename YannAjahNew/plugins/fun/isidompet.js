'use strict';
const DATA = require('../../data/v15/fun.json');
const { F, pick } = require('../../lib/primbon');

module.exports = F({ id: 'fun.isidompet', name: 'isidompet', usage: '[nama]', description: 'Terawang isi dompet gaib',
  async run(ctx) { await ctx.reply(`💸 *Hasil Terawangan Dompet Gaib*\n\n*Nama Target:* ${ctx.text || ctx.m.pushName}\n*Isi Dompet:* ${pick(DATA.isidompet)}`); } });
