'use strict';
const { UsageError } = require('../../library/errors');
const { E, fmt, parseAmount, wealth } = require('../../lib/bank');

module.exports = E({ id: 'economy.bank', name: 'bank', description: 'Bank koin: .bank | .bank deposit <jumlah|all> | .bank withdraw <jumlah|all>', usage: '[deposit|withdraw] [jumlah]',
  async run(ctx) {
    const u = ctx.user; u.money = u.money || 0; u.bank = u.bank || 0;
    const sub = (ctx.args[0] || '').toLowerCase();
    if (['deposit', 'dep', 'setor'].includes(sub)) {
      const n = parseAmount(ctx.args[1], u.money);
      if (!(n > 0)) throw new UsageError('❌ Masukkan jumlah yang valid!\nContoh: .bank deposit 1000');
      if (n > u.money) throw new UsageError(`❌ Koin di tangan tidak cukup! (${fmt(u.money)})`);
      u.money -= n; u.bank += n; ctx.db.touch();
      return ctx.reply(`✅ *Deposit Berhasil!*\n│ 💸 Disetor : *${fmt(n)}* koin\n│ 🏦 Bank : *${fmt(u.bank)}* koin\n│ 💰 Di Tangan : *${fmt(u.money)}* koin\n╰──`);
    }
    if (['withdraw', 'wd', 'tarik'].includes(sub)) {
      const n = parseAmount(ctx.args[1], u.bank);
      if (!(n > 0)) throw new UsageError('❌ Masukkan jumlah yang valid!\nContoh: .bank withdraw 500');
      if (n > u.bank) throw new UsageError(`❌ Saldo bank tidak cukup! (${fmt(u.bank)})`);
      u.bank -= n; u.money += n; ctx.db.touch();
      return ctx.reply(`✅ *Withdraw Berhasil!*\n│ 💸 Ditarik : *${fmt(n)}* koin\n│ 🏦 Bank : *${fmt(u.bank)}* koin\n│ 💰 Di Tangan : *${fmt(u.money)}* koin\n╰──`);
    }
    await ctx.reply(`╭─ᶻ 𝘇 𐰁 *Info Bank*\n│ 🏦 Saldo Bank : *${fmt(u.bank)}* koin\n│ 💰 Di Tangan : *${fmt(u.money)}* koin\n│ 💎 Total Aset : *${fmt(wealth(u))}* koin\n╰──────────\n• .bank deposit 1000\n• .bank withdraw 500`);
  } });
