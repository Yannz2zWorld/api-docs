'use strict';
const { targetJid, mention } = require('../../library/targets');
const { G } = require('../../lib/group-admin');

module.exports = G({ id: 'group.mywarn', name: 'mywarn', aliases: ['infowarn'], description: 'Cek jumlah peringatan (kamu atau @user)', usage: '[@user]',
  async run(ctx) { const t = targetJid(ctx, { self: true }); const n = ctx.group.warns?.[t] || 0; await ctx.reply(n ? `⚠️ ${mention(t)} punya ${n}/${ctx.config.limit.warnBeforeKick} peringatan.` : `✅ ${mention(t)} tidak memiliki peringatan aktif.`); } });
