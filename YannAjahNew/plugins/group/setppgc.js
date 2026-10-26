'use strict';
const { UsageError } = require('../../library/errors');
const { A, sock } = require('../../lib/group-admin');

module.exports = A({ id: 'group.setppgc', name: 'setppgc', aliases: ['setppgrup'], botAdmin: true, description: 'Ganti foto grup (kirim/reply gambar)',
  async run(ctx) { const md = ctx.media(); if (!md || !/image\/(jpe?g|png)/.test(md.mime)) throw new UsageError('❌ Kirim/reply gambar JPG/PNG.'); await sock(ctx).updateProfilePicture(ctx.m.chat, await md.download()); await ctx.reply('✅ Foto grup diganti.'); } });
