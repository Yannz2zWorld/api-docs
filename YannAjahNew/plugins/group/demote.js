'use strict';
const { jidUser } = require('../../library/function');
const { G, needTargets, sock } = require('../../lib/group');

module.exports = G({ id: 'group.demote', name: 'demote', description: 'Copot admin', usage: '@user', permission: 'admin', botAdmin: true,
  async run(ctx) { const t = needTargets(ctx); await sock(ctx).groupParticipantsUpdate(ctx.m.chat, t, 'demote'); await ctx.reply(`✅ ${t.map(j => '@' + jidUser(j)).join(', ')} bukan admin lagi.`); } });
