'use strict';
const { jidUser } = require('../../library/function');
const { E } = require('../../lib/economy');

module.exports = E({ id: 'economy.topexp', name: 'toplevel', aliases: ['topexp'], description: '10 besar exp',
  async run(ctx) { const top = Object.entries(ctx.db.raw().users).filter(([, u]) => u.exp > 0).sort((a, b) => b[1].exp - a[1].exp).slice(0, 10); await ctx.reply(top.length ? `🏆 *Top exp*\n${top.map(([j, u], i) => `${i + 1}. ${u.name || jidUser(j).slice(0, 5) + '…'} — ${u.exp} exp (lv ${u.level || 0})`).join('\n')}` : 'Belum ada data.'); } });
