'use strict';
const { UsageError } = require('../../library/errors');
const { DAY, E, EXCHANGE, fmt } = require('../../lib/bank');

module.exports = E({ id: 'economy.exchange', name: 'tukarkoin', aliases: ['exchange', 'tukaruang'], description: `Tukar koin: premium (${fmt(EXCHANGE.premium)}/hari) atau sewagc (${fmt(EXCHANGE.sewagc)}/hari, di grup)`, usage: '<premium|sewagc> <hari>', cooldown: 10,
  async run(ctx) {
    const [item, d] = [String(ctx.args[0] || '').toLowerCase(), Number(ctx.args[1] || 1)];
    const u = ctx.user; u.money = u.money || 0;
    if (!EXCHANGE[item]) return ctx.reply(`╭─ᶻ 𝘇 𐰁 💱 *Tukar Koin*\n│ Saldo kamu : ${fmt(u.money)} koin\n│ • premium : ${fmt(EXCHANGE.premium)} koin / hari\n│ • sewagc : ${fmt(EXCHANGE.sewagc)} koin / hari\n╰──\nContoh: .tukarkoin premium 3`);
    if (!Number.isInteger(d) || d < 1 || d > 365) throw new UsageError('Hari 1-365.');
    if (item === 'sewagc' && !ctx.m.isGroup) throw new UsageError('Tukar sewa grup dilakukan di grup yang mau disewa.');
    const cost = EXCHANGE[item] * d;
    if (u.money < cost) throw new UsageError(`❌ Koin kurang. Butuh ${fmt(cost)}, kamu punya ${fmt(u.money)}.`);
    u.money -= cost;
    let info;
    if (item === 'premium') { u.premiumUntil = Math.max(u.premiumUntil || 0, Date.now()) + d * DAY; info = `💎 Premium sampai ${new Date(u.premiumUntil).toLocaleString('id-ID', { timeZone: ctx.config.bot.timezone })}`; }
    else { const all = ctx.db.raw().sewa = ctx.db.raw().sewa || {}; const cur = all[ctx.m.chat]; all[ctx.m.chat] = { expiresAt: Math.max(cur?.expiresAt || 0, Date.now()) + d * DAY, by: ctx.m.sender, warned: false }; info = `🏠 Sewa grup sampai ${new Date(all[ctx.m.chat].expiresAt).toLocaleString('id-ID', { timeZone: ctx.config.bot.timezone })}`; }
    ctx.db.touch();
    await ctx.reply(`✅ Tukar berhasil (-${fmt(cost)} koin)\n${info}\nSisa koin: ${fmt(u.money)}`);
  } });
