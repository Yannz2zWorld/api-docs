'use strict';
const { UsageError } = require('../../library/errors');
const { G, sock } = require('../../lib/group');

module.exports = G({ id: 'group.hidetag', name: 'hidetag', aliases: ['ht', 'h'], description: 'Kirim pesan yang men-tag semua anggota tanpa daftar', usage: '<pesan>', permission: 'admin', cooldown: 60,
  async run(ctx) {
    const md = ctx.m.groupMetadata || await sock(ctx).groupMetadata(ctx.m.chat);
    const text = ctx.text || ctx.m.quoted?.text;
    if (!text) throw new UsageError(ctx.usage());
    await ctx.yannajah.sendmessage(ctx.m.chat, { text, mentions: md.participants.map(p => p.phoneNumber || p.id) });
  } });
