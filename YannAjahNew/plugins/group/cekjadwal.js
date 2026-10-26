'use strict';
const { G } = require('../../lib/group-admin');

module.exports = G({ id: 'group.cekjadwal', name: 'cekjadwal', description: 'Lihat jadwal buka/tutup grup',
  async run(ctx) { const d = ctx.group.dailySchedule || {}; const t = ctx.group.timedSetting; await ctx.reply(`╭─❏ *Jadwal Grup*\n│▣ Tutup : ${d.closeTime || '❌ Belum diatur'}\n│▣ Buka : ${d.openTime || '❌ Belum diatur'}${t ? `\n│▣ ${t.action === 'open' ? 'Buka' : 'Tutup'} sekali : ${Math.max(0, Math.round((t.at - Date.now()) / 60000))} menit lagi` : ''}\n│▣ Status : ${ctx.m.groupMetadata?.announce ? '🔒 TERTUTUP' : '🔓 TERBUKA'}\n╰──────────❏`); } });
