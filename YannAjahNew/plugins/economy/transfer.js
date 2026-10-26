'use strict';
const { UsageError } = require('../../library/errors');
const { jidUser, normalizePhone, toJid } = require('../../library/function');
const { E } = require('../../lib/economy');

module.exports = E({ id: 'economy.transfer', name: 'transfer', aliases: ['tf'], description: 'Kirim saldo virtual: .transfer @user jumlah', usage: '@user <jumlah>', cooldown: 5,
  async run(ctx) {
    const to = ctx.m.mentionedJid?.[0] || ctx.m.quoted?.sender || (normalizePhone(ctx.args[0] || '') && toJid(normalizePhone(ctx.args[0])));
    const amount = Number(ctx.args.find(a => /^\d+$/.test(a) && !(to && a === jidUser(to))));
    if (!to || to === ctx.m.sender) throw new UsageError(ctx.usage());
    if (!Number.isInteger(amount) || amount < 1 || amount > 1e9) throw new UsageError('Jumlah tidak valid.');
    const from = ctx.user;
    if ((from.money || 0) < amount) throw new UsageError(`Saldo kurang (${from.money || 0}).`);
    const dest = ctx.db.user(to);
    from.money -= amount; dest.money = (dest.money || 0) + amount; ctx.db.touch();
    await ctx.reply(`✅ Transfer ${amount.toLocaleString('id-ID')} ke @${jidUser(to)} berhasil. Sisa saldo: ${from.money.toLocaleString('id-ID')}`);
  } });
