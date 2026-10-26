'use strict';
const { UsageError } = require('../../library/errors');
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.addprefix', name: 'addprefix', description: 'Tambah prefix bot (1-3 karakter, maks 6 prefix)', usage: '<prefix>',
  async run(ctx) {
    const p = ctx.args[0] || '';
    if (!(p.length >= 1 && p.length <= 3)) throw new UsageError(ctx.usage());
    const s = ctx.db.settings();
    const list = s.prefix?.length ? s.prefix : [...ctx.config.prefix.list];
    if (list.includes(p)) throw new UsageError(`Prefix ${p} sudah ada.`);
    if (list.length >= 6) throw new UsageError('Maksimal 6 prefix.');
    s.prefix = [...list, p]; ctx.db.touch();
    await ctx.reply(`✅ Prefix ditambah. Sekarang: ${s.prefix.join(' ')}`);
  } });
