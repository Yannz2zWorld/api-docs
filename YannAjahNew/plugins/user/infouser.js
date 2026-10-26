'use strict';
const { feature } = require('../../library/plugin-kit');
const { jidUser } = require('../../library/function');
const { targetJid } = require('../../library/targets');

module.exports = feature({ id: 'user.infouser', name: 'infouser', aliases: ['userinfo'], category: 'user', description: 'Info user (tag/reply/nomor, atau diri sendiri): status bot, level, saldo, admin grup', usage: '[@tag/nomor]', cooldown: 3, limit: 1,
  async run(ctx) {
    const jid = targetJid(ctx, { self: true });
    const u = ctx.db.get(['users', jid]) || {};
    const owner = jidUser(jid) === String(ctx.config.owner.number) || (ctx.db.raw().owners || []).includes(jidUser(jid));
    const premium = owner || ctx.db.isPremium(jid);
    const p = ctx.m.groupMetadata?.participants?.find(x => x.id === jid || x.phoneNumber === jid || x.lid === jid);
    const lines = [
      `👤 *Info User*`,
      `• Nama: ${u.name || (jid === ctx.m.sender ? ctx.m.pushName : '-') || '-'}`,
      `• Nomor: wa.me/${jidUser(jid)}`,
      `• Status: ${owner ? 'Owner' : premium ? 'Premium' : 'User'}${u.banned ? ' (dibanned)' : ''}`,
      `• Terdaftar: ${u.registered ? 'ya' : 'tidak'}`,
      `• Level: ${u.level || 0} (${u.exp || 0} exp)`,
      `• Saldo: ${(u.money || 0).toLocaleString('id-ID')}`,
      `• Limit: ${premium ? '∞' : (u.limit ?? ctx.config.limit.daily)}`,
      `• Peringatan: ${u.warn || 0}`,
      ...(ctx.m.isGroup ? [`• Di grup ini: ${p ? (p.admin === 'superadmin' ? 'pembuat grup' : p.admin ? 'admin' : 'member') : 'bukan anggota'}`] : [])
    ];
    const pp = await ctx.yannajah.socket?.profilePictureUrl(jid, 'image').catch(() => null);
    if (pp) return ctx.sendFile(pp, { caption: lines.join('\n') }).catch(() => ctx.reply(lines.join('\n')));
    await ctx.reply(lines.join('\n'));
  } });
