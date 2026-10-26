'use strict';
const { jidUser } = require('../../library/function');
const { G, needTargets, sock } = require('../../lib/group');

module.exports = G({ id: 'group.promote', name: 'promote', aliases: ['jadiadmin'], description: 'Jadikan admin', usage: '@user', permission: 'admin', botAdmin: true,
  async run(ctx) { const t = needTargets(ctx); await sock(ctx).groupParticipantsUpdate(ctx.m.chat, t, 'promote'); await ctx.reply(`✅ ${t.map(j => '@' + jidUser(j)).join(', ')} sekarang admin.`); } });
