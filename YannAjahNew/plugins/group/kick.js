'use strict';
const { G, needTargets, sock } = require('../../lib/group');

module.exports = G({ id: 'group.kick', name: 'kick', aliases: ['kik', 'tendang'], description: 'Keluarkan anggota (tag/reply/nomor)', usage: '@user', permission: 'admin', botAdmin: true,
  async run(ctx) { const t = needTargets(ctx); await sock(ctx).groupParticipantsUpdate(ctx.m.chat, t, 'remove'); await ctx.reply(`✅ ${t.length} anggota dikeluarkan.`); } });
