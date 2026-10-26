'use strict';
const DATA = require('../../data/v15/fun.json');
const { F, fill, pick } = require('../../lib/primbon');

module.exports = F({ id: 'fun.cekjodoh', name: 'cekjodoh', usage: '<nama>', description: 'Ramalan jodoh (acak)',
  async run(ctx) { await ctx.reply(fill(pick(DATA.cekjodoh), ctx.requireText('Contoh: .cekjodoh Budi'))); } });
