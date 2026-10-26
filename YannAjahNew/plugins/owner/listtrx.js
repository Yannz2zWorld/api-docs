'use strict';
const { mention } = require('../../library/targets');
const { toIDR } = require('../../library/function');
const { O, arr } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.listtrx', name: 'listtrx', description: 'Daftar order pending',
  async run(ctx) { const l = arr(ctx.db.raw(), 'orders').filter(o => o.status === 'pending'); await ctx.reply(l.length ? l.map(o => `• ${o.id} — ${o.product} ${o.days} hari — ${toIDR(o.amount)} — ${mention(o.user)}`).join('\n') : 'Tidak ada order pending.'); } });
