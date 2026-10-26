'use strict';
const { UsageError } = require('../../library/errors');
const { G, sock } = require('../../lib/group');

module.exports = G({ id: 'group.setname', name: 'setnamagc', aliases: ['setsubject'], description: 'Ganti nama grup', usage: '<nama>', permission: 'admin', botAdmin: true,
  async run(ctx) { const t = ctx.requireText(); if (t.length > 100) throw new UsageError('Nama grup maks 100 karakter.'); await sock(ctx).groupUpdateSubject(ctx.m.chat, t); await ctx.reply('✅ Nama grup diganti.'); } });
