'use strict';
const { feature } = require('../../library/plugin-kit');
const DATA = require('../../data/v15/fun.json');
const { pick } = require('../../lib/primbon');

module.exports = feature({ id: 'islamic.quotesislami', name: 'quotesislami', aliases: ['quotesislam'], category: 'islamic', description: `Kata mutiara islami (${DATA.quotesislami.length})`,
  async run(ctx) { const q = pick(DATA.quotesislami); await ctx.reply(`${q.arabic}\n${q.arti}`); } });
