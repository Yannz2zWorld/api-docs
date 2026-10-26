'use strict';
const { G, needTargets } = require('../../lib/group');

module.exports = G({ id: 'group.unwarn', name: 'delwarn', aliases: ['unwarn'], description: 'Hapus peringatan anggota', usage: '@user', permission: 'admin',
  async run(ctx) { const [t] = needTargets(ctx); if (ctx.group.warns) delete ctx.group.warns[t]; ctx.db.touch(); await ctx.reply('✅ Peringatan dihapus.'); } });
