'use strict';
const { feature } = require('../../library/plugin-kit');
const { targetJid, mention } = require('../../library/targets');
const { arr } = require('../../lib/owner-manage');

module.exports = feature({ id: 'user.cekres', name: 'cekres', aliases: ['isreseller'], category: 'user', description: 'Cek apakah user reseller', usage: '<@tag|nomor>',
  async run(ctx) { const j = targetJid(ctx, { self: true }); const r = arr(ctx.db.raw(), 'resellers').includes(j); await ctx.reply(r ? `✅ User ${mention(j)} adalah *Reseller*.` : `❌ User ${mention(j)} bukan Reseller.`); } });
