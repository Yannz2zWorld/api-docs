'use strict';
const { G, sock } = require('../../lib/group');

module.exports = G({ id: 'group.info', name: 'groupinfo', aliases: ['infogrup', 'gcinfo'], description: 'Info grup: nama, anggota, admin, pengaturan bot',
  async run(ctx) {
    const md = ctx.m.groupMetadata || await sock(ctx).groupMetadata(ctx.m.chat);
    const admins = md.participants.filter(p => p.admin).length;
    const g = ctx.group;
    await ctx.reply([`*${md.subject}*`, `Anggota: ${md.participants.length} (admin ${admins})`, `Dibuat: ${md.creation ? new Date(md.creation * 1000).toLocaleDateString('id-ID') : '-'}`, `Pesan: ${md.announce ? 'hanya admin' : 'semua'}`, `Welcome: ${g.welcome ? 'on' : 'off'} · Left: ${g.left ? 'on' : 'off'} · Antilink: ${g.antilink ? 'on' : 'off'} · Mute bot: ${g.mute ? 'on' : 'off'}`, md.desc ? `\n${String(md.desc).slice(0, 500)}` : ''].join('\n'));
  } });
