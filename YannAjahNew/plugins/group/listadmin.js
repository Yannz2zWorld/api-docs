'use strict';
const { jidUser } = require('../../library/function');
const { G, sock } = require('../../lib/group');

module.exports = G({ id: 'group.listadmin', name: 'listadmin', aliases: ['tagadmin', 'admins'], description: 'Daftar (dan tag) admin grup',
  async run(ctx) {
    const md = ctx.m.groupMetadata || await sock(ctx).groupMetadata(ctx.m.chat);
    const admins = md.participants.filter(p => p.admin).map(p => p.phoneNumber || p.id);
    await ctx.yannajah.sendmessage(ctx.m.chat, { text: `👮 Admin grup:\n${admins.map((j, i) => `${i + 1}. @${jidUser(j)}`).join('\n')}`, mentions: admins }, { quoted: ctx.m.raw });
  } });
