'use strict';
// ----------------------------------------------------------------- streak
const { UsageError } = require('../../library/errors');
const { targetJid, mention } = require('../../library/targets');
const { G, pairKey, streakState } = require('../../lib/group-activity');

module.exports = G({ id: 'group.buatstreak', name: 'buatstreak', description: 'Mulai streak harian dengan teman: .buatstreak @user', usage: '@user',
  async run(ctx) {
    const t = targetJid(ctx); if (t === ctx.m.sender) throw new UsageError('❌ Kamu tidak bisa buat streak dengan diri sendiri!');
    const all = ctx.group.streaks = ctx.group.streaks || {}; const k = pairKey(ctx.m.sender, t);
    if (all[k] && streakState(all[k], ctx.config.bot.timezone).streak > 0) throw new UsageError(`❌ Streak dengan ${mention(t)} sudah aktif (🔥 ${all[k].streak}).`);
    all[k] = { a: ctx.m.sender, b: t, streak: 0, lastDay: null, lit: {}, best: all[k]?.best || 0, createdAt: Date.now() }; ctx.db.touch();
    await ctx.reply(`🔥 Streak ${mention(ctx.m.sender)} & ${mention(t)} dimulai!\nKalian berdua ketik *${ctx.prefix}nyalainstreak* setiap hari agar streak bertambah.`);
  } });
