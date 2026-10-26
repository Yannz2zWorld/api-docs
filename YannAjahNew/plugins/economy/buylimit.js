'use strict';
const { UsageError } = require('../../library/errors');
const { E } = require('../../lib/economy');

module.exports = E({ id: 'economy.buylimit', name: 'buylimit', aliases: ['tukarlimit'], description: 'Tukar saldo virtual dengan limit (1 limit = 500 saldo)', usage: '<jumlah>',
  async run(ctx) { const n = Number(ctx.args[0]); if (!Number.isInteger(n) || n < 1 || n > 100) throw new UsageError('Jumlah 1-100.'); const cost = n * 500; if ((ctx.user.money || 0) < cost) throw new UsageError(`Butuh ${cost} saldo.`); ctx.user.money -= cost; ctx.user.limit += n; ctx.db.touch(); await ctx.reply(`✅ +${n} limit (−${cost} saldo).`); } });
