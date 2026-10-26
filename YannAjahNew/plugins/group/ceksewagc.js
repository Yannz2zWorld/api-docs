'use strict';
const { feature } = require('../../library/plugin-kit');
const { fmtDate, left, sewa } = require('../../lib/owner-manage');

module.exports = feature({ id: 'group.ceksewagc', name: 'ceksewagc', aliases: ['ceksewa'], category: 'group', scope: 'group', description: 'Cek sisa masa sewa grup ini',
  async run(ctx) { const s = sewa(ctx, ctx.m.chat); await ctx.reply(s && s.expiresAt > Date.now() ? `🏠 *Sewa aktif*\nBerakhir: ${fmtDate(s.expiresAt, ctx)}\nSisa: ${left(s.expiresAt - Date.now())}` : `❌ Grup ini belum sewa. Info: ${ctx.prefix}sewa`); } });
