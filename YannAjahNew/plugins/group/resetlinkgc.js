'use strict';
const { G, sock } = require('../../lib/group');

module.exports = G({ id: 'group.revoke', name: 'resetlinkgc', aliases: ['revoke'], description: 'Reset link undangan grup', permission: 'admin', botAdmin: true,
  async run(ctx) { await ctx.reply(`✅ Link baru: https://chat.whatsapp.com/${await sock(ctx).groupRevokeInvite(ctx.m.chat)}`); } });
