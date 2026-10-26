'use strict';
const { O, left, obj, sock } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.listsewagc', name: 'listsewagc', description: 'Daftar grup sewa aktif',
  async run(ctx) {
    const all = Object.entries(obj(ctx.db.raw(), 'sewa'));
    if (!all.length) return ctx.reply('📭 Belum ada grup sewa.');
    const groups = await sock(ctx).groupFetchAllParticipating().catch(() => ({}));
    await ctx.reply(`📋 *GRUP SEWA* (${all.length})\n\n${all.map(([j, s], i) => `${i + 1}. ${groups[j]?.subject || j}\n   ⏳ ${s.expiresAt > Date.now() ? left(s.expiresAt - Date.now()) : 'habis'}`).join('\n')}`);
  } });
