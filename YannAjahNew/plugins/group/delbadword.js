'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { arr } = require('../../lib/owner-manage');

module.exports = feature({ id: 'group.delbadword', name: 'delbadword', aliases: ['hapusbadword'], category: 'group', scope: 'group', permission: 'admin', description: 'Hapus kata terlarang', usage: '<kata>',
  async run(ctx) { const w = ctx.requireText().toLowerCase().trim(); const l = arr(ctx.group, 'badwords'); if (!l.includes(w)) throw new UsageError(`❌ Kata "${w}" tidak ditemukan!`); ctx.group.badwords = l.filter(x => x !== w); ctx.db.touch(); await ctx.reply('✅ Dihapus.'); } });
