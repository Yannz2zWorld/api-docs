'use strict';
const DATA = require('../../data/v15/fun.json');
const { F, pick } = require('../../lib/primbon');

module.exports = F({ id: 'fun.faktadunia', name: 'faktadunia', category: 'edukasi', description: `Fakta dunia yang unik (${DATA.faktadunia.length} fakta)`,
  async run(ctx) { await ctx.reply(`🤯 *${ctx.config.bot.name} - Fakta Dunia*\n\n${pick(DATA.faktadunia).replace(/\*\*/g, '*')}`); } });
