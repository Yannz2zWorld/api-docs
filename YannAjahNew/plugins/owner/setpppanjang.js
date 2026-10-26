'use strict';
const { UsageError } = require('../../library/errors');
const { loadBaileys } = require('../../library/connection');
const { O, sock } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.setpppanjang', name: 'setpppanjang', aliases: ['setpppanjangbot', 'setppfull', 'setbotpp'], description: 'Ganti foto profil bot tanpa crop persegi (reply gambar)',
  async run(ctx) {
    const md = ctx.media(); if (!md || !/image\/(jpe?g|png)/.test(md.mime)) throw new UsageError('Kirim/reply gambar JPG/PNG.');
    const { Jimp } = require('jimp');
    const img = await Jimp.read(await md.download());
    img.scaleToFit({ w: 720, h: 720 });
    const jpg = await img.getBuffer('image/jpeg');
    const B = await loadBaileys(); const s = sock(ctx);
    // Sama dengan sock.updateProfilePicture untuk akun sendiri, tapi tanpa crop persegi.
    await s.query({ tag: 'iq', attrs: { to: B.S_WHATSAPP_NET, type: 'set', xmlns: 'w:profile:picture' }, content: [{ tag: 'picture', attrs: { type: 'image' }, content: jpg }] });
    await ctx.reply('✅ Foto profil bot diganti (tanpa crop).');
  } });
