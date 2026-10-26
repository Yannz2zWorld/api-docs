'use strict';
const { UsageError } = require('../../library/errors');
const { targetJid, mention } = require('../../library/targets');
const { G, streakState } = require('../../lib/group-activity');

module.exports = G({ id: 'group.cekstreak', name: 'cekstreak', aliases: ['streak'], description: 'Cek streak kamu (atau dengan @user)', usage: '[@user]',
  async run(ctx) {
    const tz = ctx.config.bot.timezone; const all = ctx.group.streaks || {};
    const other = (ctx.m.mentionedJid?.length || ctx.m.quoted) ? targetJid(ctx) : null;
    const list = Object.values(all).filter(s => (s.a === ctx.m.sender || s.b === ctx.m.sender) && (!other || s.a === other || s.b === other));
    if (!list.length) throw new UsageError('❌ Belum ada streak.');
    await ctx.reply(list.map(s => { const st = streakState(s, tz); const o = s.a === ctx.m.sender ? s.b : s.a; return `🔥 ${mention(o)}: *${st.streak} hari* ${st.litToday ? '(sudah menyala hari ini)' : st.streak ? '(belum menyala hari ini!)' : '(padam)'} — rekor ${s.best || 0}`; }).join('\n'));
  } });
