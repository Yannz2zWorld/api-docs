'use strict';
const { E, board } = require('../../lib/bank');

module.exports = E({ id: 'economy.topbalance', name: 'topbalance', aliases: ['topmoney', 'lbmoney', 'moneylb', 'leaderboardmoney'], description: 'Top 10 terkaya (koin + bank)',
  async run(ctx) { await ctx.reply(board(ctx, 'TOP BALANCE')); } });
