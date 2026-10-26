'use strict';
const { jidUser } = require('../../library/function');
const { G, needTargets, sock } = require('../../lib/group');

module.exports = G({ id: 'group.warn', name: 'warn', aliases: ['peringatan', 'warning'], description: 'Beri peringatan; kena batas = dikeluarkan (kalau bot admin)', usage: '@user [alasan]', permission: 'admin',
  async run(ctx) {
    const [t] = needTargets(ctx);
    const warns = ctx.group.warns = ctx.group.warns || {};
    warns[t] = (warns[t] || 0) + 1; ctx.db.touch();
    const max = ctx.config.limit.warnBeforeKick;
    await ctx.yannajah.sendmessage(ctx.m.chat, { text: `⚠️ @${jidUser(t)} mendapat peringatan ${warns[t]}/${max}${ctx.args.slice(1).length ? `\nAlasan: ${ctx.args.slice(1).join(' ').replace(/@\d+/g, '').trim()}` : ''}`, mentions: [t] });
    if (warns[t] >= max) {
      delete warns[t]; ctx.db.touch();
      if (ctx.m.isBotAdmin) { await sock(ctx).groupParticipantsUpdate(ctx.m.chat, [t], 'remove'); await ctx.reply('🚫 Batas peringatan tercapai, anggota dikeluarkan.'); }
      else await ctx.reply('🚫 Batas peringatan tercapai, tetapi bot bukan admin sehingga tidak bisa mengeluarkan.');
    }
  } });
