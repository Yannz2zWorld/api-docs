'use strict';
const { UsageError } = require('../../library/errors');
const { A, DAY, act, botJid, members } = require('../../lib/group-activity');

module.exports = A({ id: 'group.kicksider', name: 'kicksider', aliases: ['siderkick'], botAdmin: true, cooldown: 30, description: 'Keluarkan member pasif: .kicksider <hari> confirm (maks 50 sekali jalan)', usage: '<hari> confirm',
  async run(ctx) {
    const days = Math.min(Math.max(Number(ctx.args[0]) || 7, 1), 365);
    const a = act(ctx.group); const cut = Date.now() - days * DAY; const bot = botJid(ctx);
    if (Date.now() - a.since < days * DAY) throw new UsageError(`❌ Bot baru mencatat ${Math.floor((Date.now() - a.since) / DAY)} hari. Tunggu sampai ${days} hari agar tidak salah kick.`);
    const list = members(ctx).filter(p => !p.admin && p.jid !== bot && !((a.users[p.jid]?.last || 0) > cut)).map(p => p.jid).slice(0, 50);
    if (!list.length) return ctx.reply('✅ Tidak ada sider.');
    if (!ctx.args.includes('confirm')) throw new UsageError(`⚠️ ${list.length} member akan dikeluarkan. Lanjut: ${ctx.prefix}kicksider ${days} confirm`);
    for (let i = 0; i < list.length; i += 5) await ctx.yannajah.socket.groupParticipantsUpdate(ctx.m.chat, list.slice(i, i + 5), 'remove');
    await ctx.reply(`✅ ${list.length} sider dikeluarkan.`);
  } });
