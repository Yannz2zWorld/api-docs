'use strict';
const { UsageError } = require('../../library/errors');
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.feature.enable', name: 'enablefitur', aliases: ['nyalakanfitur'], description: 'Aktifkan lagi fitur', usage: '<command>',
  async run(ctx) { const f = ctx.yannajah.plugins.enable(ctx.requireText().split(/\s+/)[0]); if (!f) throw new UsageError('Command tidak ditemukan.'); ctx.db.touch(); await ctx.reply(`✅ ${f.name} diaktifkan.`); } });
