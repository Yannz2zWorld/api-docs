'use strict';
const { jidUser } = require('../../library/function');
const { G, LINK_RE, sock } = require('../../lib/group');

module.exports = G({ id: 'group.antilink.hook', name: 'antilinkstatus', description: 'Status anti-link grup ini', permission: 'admin',
  async run(ctx) { await ctx.reply(`Anti-link: *${ctx.group.antilink ? 'ON' : 'OFF'}*`); },
  // Hook anti-link: hapus pesan berisi link grup lain dari non-admin (butuh bot admin).
  async onMessage(ctx) {
    const m = ctx.m;
    if (!m.isGroup || m.fromMe || ctx.isOwner || m.isAdmin || !m.isBotAdmin) return false;
    const g = ctx.db.get(['groups', m.chat]);
    if (!g?.antilink) return false;
    const link = LINK_RE.exec(m.body || '');
    if (!link) return false;
    const own = await sock(ctx).groupInviteCode(m.chat).catch(() => null);
    if (own && link[1] === own) return false;
    await ctx.yannajah.sendmessage(m.chat, { delete: m.key });
    await ctx.yannajah.sendmessage(m.chat, { text: `🔗 @${jidUser(m.sender)} link grup lain tidak diizinkan di sini.`, mentions: [m.sender] });
    return true;
  } });
