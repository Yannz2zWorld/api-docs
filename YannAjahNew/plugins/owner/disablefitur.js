'use strict';
const { UsageError } = require('../../library/errors');
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.feature.disable', name: 'disablefitur', aliases: ['matikanfitur'], description: 'Nonaktifkan fitur (disimpan di database)', usage: '<command>',
  async run(ctx) { const f = ctx.yannajah.plugins.disable(ctx.requireText().split(/\s+/)[0]); if (!f) throw new UsageError('Command tidak ditemukan.'); if (f.category === 'owner') { ctx.yannajah.plugins.enable(f.id); throw new UsageError('Fitur owner tidak bisa dimatikan.'); } ctx.db.touch(); await ctx.reply(`⛔ ${f.name} dinonaktifkan.`); } });
