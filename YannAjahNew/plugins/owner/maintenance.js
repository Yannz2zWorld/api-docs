'use strict';
const { O } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.maintenance', name: 'maintenance', aliases: ['mt'], description: 'Maintenance bot (lokal): on [pesan] / off / status. Maintenance dari dashboard tetap berlaku terpisah', usage: 'on [pesan]|off|status',
  async run(ctx) {
    const st = ctx.db.settings(); const mode = (ctx.args[0] || '').toLowerCase();
    if (['on', 'aktif', '1'].includes(mode)) { st.maintenance = { active: true, message: ctx.args.slice(1).join(' ').slice(0, 300) || 'Bot sedang maintenance, coba lagi nanti.', since: Date.now() }; ctx.db.touch(); return ctx.reply(`🔧 Maintenance AKTIF\nPesan: ${st.maintenance.message}`); }
    if (['off', 'nonaktif', '0'].includes(mode)) { st.maintenance = { active: false }; ctx.db.touch(); return ctx.reply('✅ Maintenance dimatikan.'); }
    const d = ctx.yannajah.auth?.maintenance?.() || {};
    await ctx.reply(`╭─🔧 *Maintenance*\n│ Lokal : ${st.maintenance?.active ? `AKTIF — ${st.maintenance.message}` : 'nonaktif'}\n│ Dashboard : ${d.active ? `AKTIF — ${d.message}` : 'nonaktif'}\n╰─ ${ctx.usage()}`);
  } });
