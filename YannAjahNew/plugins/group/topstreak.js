'use strict';
const { UsageError } = require('../../library/errors');
const { mention } = require('../../library/targets');
const { G, streakState } = require('../../lib/group-activity');

module.exports = G({ id: 'group.topstreak', name: 'topstreak', description: 'Top 5 streak di grup',
  async run(ctx) {
    const tz = ctx.config.bot.timezone;
    const list = Object.values(ctx.group.streaks || {}).map(s => ({ s, n: streakState(s, tz).streak })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 5);
    if (!list.length) throw new UsageError('❌ Belum ada streak yang berhasil dipertahankan di grup ini.');
    await ctx.reply(`🏆 *TOP 5 DAILY STREAK*\n\n${list.map((x, i) => `${i + 1}. ${mention(x.s.a)} & ${mention(x.s.b)} — 🔥 ${x.n} hari`).join('\n')}`);
  } });
