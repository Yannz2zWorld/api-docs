'use strict';
const { G, sock } = require('../../lib/group');

module.exports = G({ id: 'group.close', name: 'closegc', aliases: ['tutupgrup', 'close'], description: 'Tutup grup (hanya admin yang bisa kirim pesan)', permission: 'admin', botAdmin: true,
  async run(ctx) { await sock(ctx).groupSettingUpdate(ctx.m.chat, 'announcement'); await ctx.reply('🔒 Grup ditutup.'); } });
