'use strict';
const { UsageError } = require('../../library/errors');
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.delprefix', name: 'delprefix', description: 'Hapus salah satu prefix bot (minimal tersisa 1)', usage: '<prefix>',
  async run(ctx) {
    const p = ctx.args[0] || '';
    const s = ctx.db.settings();
    const list = s.prefix?.length ? s.prefix : [...ctx.config.prefix.list];
    if (!list.includes(p)) throw new UsageError(`Prefix ${p || '(kosong)'} tidak ada. Prefix: ${list.join(' ')}`);
    if (list.length <= 1) throw new UsageError('Minimal harus ada 1 prefix.');
    s.prefix = list.filter(x => x !== p); ctx.db.touch();
    await ctx.reply(`✅ Prefix ${p} dihapus. Sekarang: ${s.prefix.join(' ')}`);
  } });
