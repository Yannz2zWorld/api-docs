'use strict';
const { UsageError } = require('../../library/errors');
const { mention } = require('../../library/targets');
const { G, streakState } = require('../../lib/group-activity');

module.exports = G({ id: 'group.nyalainstreak', name: 'nyalainstreak', aliases: ['nyalakanstreak'], description: 'Nyalakan streak hari ini (dua orang harus menyalakan)',
  async run(ctx) {
    const tz = ctx.config.bot.timezone; const all = ctx.group.streaks || {};
    const mine = Object.values(all).filter(s => s.a === ctx.m.sender || s.b === ctx.m.sender);
    if (!mine.length) throw new UsageError(`❌ Kamu belum punya streak. Mulai: ${ctx.prefix}buatstreak @teman`);
    const out = [];
    for (const s of mine) {
      const st = streakState(s, tz); const other = s.a === ctx.m.sender ? s.b : s.a;
      s.lit = s.lit || {}; s.lit[ctx.m.sender] = st.today;
      if (st.litToday) { out.push(`✅ Streak dengan ${mention(other)} sudah menyala hari ini (🔥 ${s.streak})`); continue; }
      if (s.lit[other] === st.today) { s.streak = st.streak + 1; s.lastDay = st.today; s.best = Math.max(s.best || 0, s.streak); out.push(`🔥 Streak dengan ${mention(other)} naik jadi *${s.streak} hari*!`); }
      else out.push(`⏳ Menunggu ${mention(other)} menyalakan streak hari ini.`);
    }
    ctx.db.touch(); await ctx.reply(out.join('\n'));
  } });
