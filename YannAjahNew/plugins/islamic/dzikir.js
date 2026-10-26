'use strict';
const { feature } = require('../../library/plugin-kit');
const DATA = require('../../data/v15/fun.json');

module.exports = feature({ id: 'islamic.dzikir', name: 'dzikir', aliases: ['wirid'], category: 'islamic', description: 'Wirid & dzikir setelah sholat fardhu', async run(ctx) { await ctx.reply(DATA.dzikir); } });
