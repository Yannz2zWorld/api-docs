'use strict';
const { O, obj } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.listkode', name: 'listkode', description: 'Daftar kode redeem', async run(ctx) { const c = Object.entries(obj(ctx.db.raw(), 'redeemCodes')); await ctx.reply(c.length ? c.map(([k, v]) => `• *${k}* — ${v.item} ${v.value} — ${v.claimed.length}/${v.max}`).join('\n') : 'Belum ada kode.'); } });
