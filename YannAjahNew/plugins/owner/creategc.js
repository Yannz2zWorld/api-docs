'use strict';
const { O, sock } = require('../../lib/group-admin');

module.exports = O({ id: 'owner.creategc', name: 'creategc', aliases: ['creategroup', 'creategrup'], description: 'Buat grup baru (kamu dijadikan member)', usage: '<nama grup>',
  async run(ctx) {
    const name = ctx.requireText('❌ Masukkan nama grup. Contoh: .creategc Nama Grup').slice(0, 100);
    const g = await sock(ctx).groupCreate(name, [ctx.m.sender]);
    const code = await sock(ctx).groupInviteCode(g.id).catch(() => null);
    await sock(ctx).groupParticipantsUpdate(g.id, [ctx.m.sender], 'promote').catch(() => {});
    await ctx.reply(`✅ *Berhasil Membuat Grup*\n\n📛 Nama: ${name}\n🆔 ID: ${g.id}${code ? `\n🔗 Link: https://chat.whatsapp.com/${code}` : ''}`);
  } });
