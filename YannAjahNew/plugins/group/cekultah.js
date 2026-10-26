'use strict';
const { UsageError } = require('../../library/errors');
const scheduler = require('../../library/scheduler');
const { targetJid, mention } = require('../../library/targets');
const { DAY, G, MONTHS } = require('../../lib/group-activity');

module.exports = G({ id: 'group.cekultah', name: 'cekultah', aliases: ['ultah'], description: 'Hitung mundur ulang tahun (kamu atau @user)', usage: '[@user]',
  async run(ctx) {
    const t = targetJid(ctx, { self: true }); const b = ctx.group.birthdays?.[t];
    if (!b) throw new UsageError(`❌ ${t === ctx.m.sender ? `Kamu belum mendaftarkan ulang tahun. ${ctx.prefix}setultah DD/MM` : 'User belum mendaftarkan ulang tahun.'}`);
    const now = scheduler.localNow(ctx.config.bot.timezone);
    const today = Date.UTC(now.year, now.month - 1, now.day);
    let next = Date.UTC(now.year, b.month - 1, b.day); if (next < today) next = Date.UTC(now.year + 1, b.month - 1, b.day);
    const d = Math.round((next - today) / DAY);
    await ctx.reply(d === 0 ? `🎂 ${mention(t)} hari ini ulang tahun${b.year ? ` yang ke-${now.year - b.year}` : ''}! 🎉` : `🎂 Ulang tahun ${mention(t)}: ${b.day} ${MONTHS[b.month - 1]}\n⏳ ${d} hari lagi`);
  } });
