'use strict';
const { G, sock } = require('../../lib/group');

module.exports = G({ id: 'group.open', name: 'opengc', aliases: ['bukagrup', 'open'], description: 'Buka grup (semua anggota bisa kirim pesan)', permission: 'admin', botAdmin: true,
  async run(ctx) { await sock(ctx).groupSettingUpdate(ctx.m.chat, 'not_announcement'); await ctx.reply('🔓 Grup dibuka.'); } });
