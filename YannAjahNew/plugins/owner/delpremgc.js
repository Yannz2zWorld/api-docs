'use strict';
const { O } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.delpremgc', name: 'delpremgc', aliases: ['delpremgrup', 'deletepremgc'], scope: 'group', description: 'Cabut premium semua member grup',
  async run(ctx) {
    let n = 0;
    for (const p of ctx.m.groupMetadata?.participants || []) { const u = ctx.db.get(['users', p.phoneNumber || p.id]); if (u?.premiumUntil > Date.now()) { u.premiumUntil = 0; n++; } }
    ctx.db.touch();
    await ctx.reply(n ? `✅ Premium grup dihapus\nMember: ${n} orang` : '❌ Tidak ada member premium di grup ini.');
  } });
