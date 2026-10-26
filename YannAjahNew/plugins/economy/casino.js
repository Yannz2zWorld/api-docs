'use strict';
const crypto = require('crypto');
const { UsageError } = require('../../library/errors');
const { CASINO_MIN, E, fmt, parseAmount } = require('../../lib/bank');

module.exports = E({ id: 'economy.casino', name: 'casino', description: `Taruhan koin 50/50 (menang = 2x). Minimal ${fmt(CASINO_MIN)} koin`, usage: '<taruhan|all>', cooldown: 10,
  async run(ctx) {
    const u = ctx.user; u.money = u.money || 0;
    const bet = parseAmount(ctx.args[0], u.money);
    if (!(bet > 0)) return ctx.reply(`🎲 *CASINO*\n\nContoh: .casino 10000\n• Menang → uang kamu *2x*\n• Kalah → taruhan hangus\n• Taruhan minimal: ${fmt(CASINO_MIN)} koin`);
    if (bet < CASINO_MIN) throw new UsageError(`❌ Taruhan minimal *${fmt(CASINO_MIN)} koin*!`);
    if (u.money < bet) throw new UsageError(`❌ Koin tidak cukup! Koin kamu: *${fmt(u.money)}*`);
    const d1 = crypto.randomInt(1, 7), d2 = crypto.randomInt(1, 7); const win = crypto.randomInt(0, 2) === 1;
    u.money += win ? bet : -bet; ctx.db.touch();
    const face = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    await ctx.reply(`🎲 *CASINO*\n${face[d1]} + ${face[d2]} = *${d1 + d2}* (${(d1 + d2) % 2 ? 'Ganjil' : 'Genap'})\n\n${win ? '✅ *MENANG!*' : '❌ *KALAH!*'}\n\n💸 Taruhan : *${fmt(bet)}* koin\n${win ? '🏆 Untung' : '📉 Rugi'} : *${win ? '+' : '-'}${fmt(bet)}* koin\n💰 Koin : *${fmt(u.money)}*`);
  } });
