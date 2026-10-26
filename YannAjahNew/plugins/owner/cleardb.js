'use strict';
const { UsageError } = require('../../library/errors');
const { O } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.cleardb', name: 'cleardb', aliases: ['resetdb', 'rstdb'], description: 'Kosongkan database lokal bot (user, grup, data fitur). Wajib: .cleardb confirm', usage: 'confirm',
  async run(ctx) {
    if (ctx.args[0] !== 'confirm') throw new UsageError(`⚠️ Ini menghapus SEMUA data lokal (user, limit, saldo, grup, list, sewa...).\nBackup dulu: ${ctx.prefix}backupdb\nLanjut: ${ctx.prefix}cleardb confirm`);
    await ctx.db.save();
    const keep = { settings: ctx.db.raw().settings, owners: ctx.db.raw().owners };
    for (const k of Object.keys(ctx.db.raw())) delete ctx.db.raw()[k];
    Object.assign(ctx.db.raw(), require('../../source/database').DEFAULTS(), keep);
    ctx.db.touch(); await ctx.db.save();
    await ctx.reply('🗑️ Database lokal dikosongkan (pengaturan & owner tambahan dipertahankan).');
  } });
