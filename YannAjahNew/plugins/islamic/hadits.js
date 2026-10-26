'use strict';
const { feature } = require('../../library/plugin-kit');
const DATA = require('../../data/v15/fun.json');
const { pick } = require('../../lib/primbon');

module.exports = feature({ id: 'islamic.hadits', name: 'hadits', aliases: ['haditsharian'], category: 'islamic', description: 'Hadits harian singkat', async run(ctx) { const h = pick(DATA.hadits); await ctx.reply(`📜 *Hadits Harian*\n\n"${h.hadits}"\n\n- (HR. ${h.rawi}) -`); } });
