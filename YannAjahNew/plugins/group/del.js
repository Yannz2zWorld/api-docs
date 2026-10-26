'use strict';
const { UsageError } = require('../../library/errors');
const { G } = require('../../lib/group');

module.exports = G({ id: 'group.delete', name: 'del', aliases: ['delete', 'hapus'], description: 'Hapus pesan yang di-reply (pesan bot, atau pesan anggota jika bot admin)', permission: 'admin',
  async run(ctx) {
    const q = ctx.m.quoted;
    if (!q) throw new UsageError('Reply pesan yang mau dihapus.');
    if (!q.key.fromMe && !ctx.m.isBotAdmin) throw new UsageError('Bot harus admin untuk menghapus pesan anggota.');
    await ctx.yannajah.sendmessage(ctx.m.chat, { delete: { remoteJid: ctx.m.chat, fromMe: q.key.fromMe, id: q.id, participant: q.senderRaw } });
  } });
