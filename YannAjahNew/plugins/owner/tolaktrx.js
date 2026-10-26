'use strict';
const { UsageError } = require('../../library/errors');
const { O, findOrder } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.tolaktrx', name: 'tolaktrx', description: 'Tolak order', usage: '<order id> [alasan]',
  async run(ctx) { const o = findOrder(ctx, ctx.args[0]); if (!o || o.status !== 'pending') throw new UsageError('❌ Order tidak ditemukan / sudah diproses.'); o.status = 'rejected'; ctx.db.touch(); await ctx.yannajah.sendmessage(o.chat, { text: `❌ Order ${o.id} ditolak. ${ctx.args.slice(1).join(' ')}`.trim(), mentions: [o.user] }).catch(() => {}); await ctx.reply('✅ Order ditolak.'); } });
