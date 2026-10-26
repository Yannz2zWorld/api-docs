'use strict';
const { O } = require('../../lib/group-admin');

module.exports = O({ id: 'owner.onlygc', name: 'onlygc', aliases: ['onlygrup', 'onlygroup'], description: 'Bot hanya merespons di grup (chat pribadi diabaikan, kecuali owner)', usage: 'on/off',
  async run(ctx) { const v = (ctx.args[0] || '').toLowerCase(); const st = ctx.db.settings(); if (!['on', 'off'].includes(v)) return ctx.reply(`⚙️ *Mode Hanya Grup: ${st.onlyGroup ? '✅ AKTIF' : '❌ NONAKTIF'}*\n${ctx.usage()}`); st.onlyGroup = v === 'on'; ctx.db.touch(); await ctx.reply(v === 'on' ? '✅ Mode "Hanya Grup" diaktifkan.' : '❌ Mode "Hanya Grup" dinonaktifkan.'); },
  async onMessage(ctx) { return Boolean(ctx.db.settings().onlyGroup && !ctx.m.isGroup && !ctx.isOwner); } });
