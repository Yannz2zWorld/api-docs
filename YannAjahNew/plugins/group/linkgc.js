'use strict';
const { G, sock } = require('../../lib/group');

module.exports = G({ id: 'group.link', name: 'linkgc', aliases: ['linkgrup'], description: 'Link undangan grup', botAdmin: true,
  async run(ctx) { await ctx.reply(`https://chat.whatsapp.com/${await sock(ctx).groupInviteCode(ctx.m.chat)}`); } });
