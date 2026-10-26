'use strict';
const { UsageError } = require('../../library/errors');
const { G, sock } = require('../../lib/group');

module.exports = G({ id: 'group.setdesc', name: 'setdesc', aliases: ['setdeskripsi'], description: 'Ganti deskripsi grup', usage: '<deskripsi>', permission: 'admin', botAdmin: true,
  async run(ctx) { const t = ctx.requireText(); if (t.length > 2000) throw new UsageError('Deskripsi maks 2000 karakter.'); await sock(ctx).groupUpdateDescription(ctx.m.chat, t); await ctx.reply('✅ Deskripsi grup diganti.'); } });
