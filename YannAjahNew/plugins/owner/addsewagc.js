'use strict';
// ----------------------------------------------------------------- sewa grup
const { UsageError } = require('../../library/errors');
const { amountArg } = require('../../library/targets');
const { DAY, O, ensureSewaLoop, fmtDate, obj, resolveGroup, sock } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.addsewagc', name: 'addsewagc', description: 'Sewakan bot ke grup: .addsewagc <hari> (di grup) atau .addsewagc <link> <hari>', usage: '[link] <hari>',
  async run(ctx) {
    const days = amountArg(ctx, { max: 3650 }); if (!days) throw new UsageError(ctx.usage());
    const g = await resolveGroup(ctx);
    const all = obj(ctx.db.raw(), 'sewa'); const cur = all[g.jid];
    all[g.jid] = { expiresAt: Math.max(cur?.expiresAt || 0, Date.now()) + days * DAY, by: ctx.m.sender, warned: false };
    ctx.db.touch(); ensureSewaLoop(ctx.yannajah);
    const name = (await sock(ctx).groupMetadata(g.jid).catch(() => null))?.subject || g.jid;
    await ctx.reply(`✅ *Sewa grup ${cur ? 'diperpanjang' : 'aktif'}*\nGrup: ${name}\nStatus: ${g.status}\nBerakhir: ${fmtDate(all[g.jid].expiresAt, ctx)}`);
  } });
