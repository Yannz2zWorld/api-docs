'use strict';
const { G, sock } = require('../../lib/group');

module.exports = G({ id: 'group.leave', name: 'leave', aliases: ['keluar'], description: 'Bot keluar dari grup ini', permission: 'owner',
  async run(ctx) { await ctx.reply('👋 Bot keluar dari grup.'); await sock(ctx).groupLeave(ctx.m.chat); } });
