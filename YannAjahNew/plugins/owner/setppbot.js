'use strict';
const { UsageError } = require('../../library/errors');
const { O, sock } = require('../../lib/owner');

module.exports = O({ id: 'owner.setppbot', name: 'setppbot', description: 'Ganti foto profil bot (reply/kirim gambar)',
  async run(ctx) { const md = ctx.media(); if (!md || !/image/.test(md.mime)) throw new UsageError('Kirim/reply gambar.'); const buf = await md.download(); await sock(ctx).updateProfilePicture(sock(ctx).user.id, buf); await ctx.reply('✅ Foto profil bot diganti.'); } });
