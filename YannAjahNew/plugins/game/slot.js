'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { rnd } = require('../../lib/minigame');

module.exports = feature({ id: 'game.slot', name: 'slot', category: 'game', description: 'Mesin slot memakai saldo: .slot <taruhan>', usage: '<taruhan>', cooldown: 5,
  async run(ctx) {
    const bet = Number(ctx.args[0]);
    if (!Number.isInteger(bet) || bet < 10 || bet > 100000) throw new UsageError('Taruhan 10 - 100.000 saldo.');
    const u = ctx.user;
    if ((u.money || 0) < bet) throw new UsageError(`Saldo kurang. Saldo kamu: ${u.money || 0}`);
    const sym = ['🍒', '🍋', '🍇', '🔔', '⭐', '💎'];
    const r = [0, 1, 2].map(() => sym[rnd(0, sym.length - 1)]);
    const mult = r[0] === r[1] && r[1] === r[2] ? (r[0] === '💎' ? 10 : 5) : r[0] === r[1] || r[1] === r[2] || r[0] === r[2] ? 1.5 : 0;
    const win = Math.floor(bet * mult);
    u.money = u.money - bet + win; ctx.db.touch();
    await ctx.reply(`🎰 | ${r.join(' | ')} |\n${mult ? `Menang ${win} (x${mult})` : `Kalah ${bet}`}\nSaldo: ${u.money}`);
  } });
