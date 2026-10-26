'use strict';
const { O, ensureSewaLoop, sewa } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.sistemsewa', name: 'sistemsewa', description: 'Sistem sewa: bot hanya melayani grup yang sewa', usage: 'on/off',
  async run(ctx) {
    const v = (ctx.args[0] || '').toLowerCase(); const st = ctx.db.settings();
    if (!['on', 'off'].includes(v)) return ctx.reply(`╭一緒 *Sistem Sewa*\n│୭ ˚.ᵎᵎ Status : ${st.sistemSewa ? '✅ AKTIF' : '❌ NONAKTIF'}\n╰─────────一緒\n${ctx.usage()}`);
    st.sistemSewa = v === 'on'; ctx.db.touch(); ensureSewaLoop(ctx.yannajah);
    await ctx.reply(v === 'on' ? '✅ Sistem Sewa AKTIF\nBot hanya bisa digunakan di grup yang sudah sewa.' : '✅ Sistem Sewa NONAKTIF\nBot bisa digunakan di semua grup.');
  },
  async onMessage(ctx) {
    ensureSewaLoop(ctx.yannajah);
    if (!ctx.m.isGroup || !ctx.m.isCmd || ctx.isOwner || !ctx.db.settings().sistemSewa) return false;
    const s = sewa(ctx, ctx.m.chat);
    if (s && s.expiresAt > Date.now()) return false;
    if (['sewa', 'prem', 'buysewagc', 'owner', 'ceksewagc'].includes(ctx.m.command)) return false;
    const g = ctx.db.group(ctx.m.chat);
    if (!g.sewaNotifiedAt || Date.now() - g.sewaNotifiedAt > 6 * 3600000) { g.sewaNotifiedAt = Date.now(); ctx.db.touch(); await ctx.reply(`🔒 Grup ini belum sewa bot.\nInfo sewa: ${ctx.prefix}sewa`); }
    return true;
  } });
