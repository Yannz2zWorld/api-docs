'use strict';
const { jidUser } = require('../../library/function');
const { G, sock } = require('../../lib/group');

module.exports = G({ id: 'group.tagall', name: 'tagall', aliases: ['everyone'], description: 'Tag semua anggota (dengan daftar)', usage: '[pesan]', permission: 'admin', cooldown: 60,
  async run(ctx) {
    const md = ctx.m.groupMetadata || await sock(ctx).groupMetadata(ctx.m.chat);
    const all = md.participants.map(p => p.phoneNumber || p.id);
    await ctx.yannajah.sendmessage(ctx.m.chat, { text: `📢 ${ctx.text || 'Perhatian semua!'}\n\n${all.map(j => `• @${jidUser(j)}`).join('\n')}`, mentions: all });
  } });
