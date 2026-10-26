'use strict';
const { UsageError } = require('../../library/errors');
const { O, obj, resolveGroup } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.delsewagc', name: 'delsewagc', description: 'Hentikan sewa grup (di grup atau dengan ID grup)', usage: '[id grup]',
  async run(ctx) { const g = await resolveGroup(ctx); const all = obj(ctx.db.raw(), 'sewa'); if (!all[g.jid]) throw new UsageError('❌ Grup ini tidak sedang sewa.'); delete all[g.jid]; ctx.db.touch(); await ctx.reply('✅ Sewa grup dihapus.'); } });
