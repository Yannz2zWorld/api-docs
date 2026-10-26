'use strict';
const DATA = require('../../data/v15/fun.json');
const { F, fill, pick } = require('../../lib/primbon');

module.exports = F({ id: 'fun.cekmasadepan', name: 'cekmasadepan', usage: '<nama>', description: 'Ramalan masa depan (acak)',
  async run(ctx) { await ctx.reply(fill(pick(DATA.cekmasadepan), ctx.requireText('Contoh: .cekmasadepan Budi'))); } });
