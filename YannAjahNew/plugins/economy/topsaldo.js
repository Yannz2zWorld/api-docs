'use strict';
const { jidUser } = require('../../library/function');
const { E } = require('../../lib/economy');

module.exports = E({ id: 'economy.top', name: 'topsaldo', aliases: ['leaderboard', 'lb', 'richest'], description: '10 besar saldo',
  async run(ctx) { const top = Object.entries(ctx.db.raw().users).filter(([, u]) => u.money > 0).sort((a, b) => b[1].money - a[1].money).slice(0, 10); await ctx.reply(top.length ? `🏆 *Top saldo*\n${top.map(([j, u], i) => `${i + 1}. ${u.name || jidUser(j).slice(0, 5) + '…'} — ${u.money.toLocaleString('id-ID')}`).join('\n')}` : 'Belum ada data.'); } });
