'use strict';
const { UsageError } = require('../../library/errors');
const { targetJid, mention } = require('../../library/targets');
const { A } = require('../../lib/group-admin');

module.exports = A({ id: 'group.resetwarn', name: 'resetwarn', description: 'Reset peringatan @user, atau semua member jika tanpa target', usage: '[@user]',
  async run(ctx) { const has = ctx.m.mentionedJid?.length || ctx.m.quoted || ctx.args.length; if (has) { const t = targetJid(ctx); if (!ctx.group.warns?.[t]) throw new UsageError(`❌ ${mention(t)} tidak ada warn.`); delete ctx.group.warns[t]; ctx.db.touch(); return ctx.reply(`✅ Warn ${mention(t)} direset.`); } const n = Object.keys(ctx.group.warns || {}).length; ctx.group.warns = {}; ctx.db.touch(); await ctx.reply(`✅ Warn ${n} member direset.`); } });
