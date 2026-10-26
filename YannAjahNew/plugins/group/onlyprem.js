'use strict';
const { feature } = require('../../library/plugin-kit');

module.exports = feature({ id: 'group.onlyprem', name: 'onlyprem', category: 'group', scope: 'group', permission: 'admin', description: 'Mode grup: hanya user premium yang bisa memakai bot', usage: 'on/off',
  async run(ctx) { const v = (ctx.args[0] || '').toLowerCase(); if (!['on', 'off'].includes(v)) return ctx.reply(`Mode onlyPrem: *${ctx.group.onlyPrem ? 'ON' : 'OFF'}*\n${ctx.usage()}`); ctx.group.onlyPrem = v === 'on'; ctx.db.touch(); await ctx.reply(`Mode onlyPrem ${v === 'on' ? 'diaktifkan' : 'dimatikan'} untuk grup ini.`); },
  async onMessage(ctx) { if (!ctx.m.isGroup || !ctx.m.isCmd || ctx.isPremium || ctx.isAdmin) return false; if (!ctx.db.get(['groups', ctx.m.chat, 'onlyPrem'])) return false; await ctx.reply(ctx.config.mess.prem); return true; } });
