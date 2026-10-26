'use strict';
const { UsageError } = require('../../library/errors');
const { DAY, LINK_RE, O, addPremium, ensureSewaLoop, findOrder, fmtDate, obj, sock } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.acctrx', name: 'acctrx', aliases: ['konfirmasitrx'], description: 'Konfirmasi order (premium/sewa langsung aktif)', usage: '<order id>',
  async run(ctx) {
    const o = findOrder(ctx, ctx.args[0]); if (!o || o.status !== 'pending') throw new UsageError('❌ Order tidak ditemukan / sudah diproses.');
    let info;
    if (o.product === 'premium') info = `💎 Premium aktif sampai ${fmtDate(addPremium(ctx, o.user, o.days), ctx)}`;
    else {
      const code = LINK_RE.exec(o.link || '')?.[1];
      let jid = await sock(ctx).groupAcceptInvite(code).catch(() => null);
      if (!jid) jid = (await sock(ctx).groupGetInviteInfo(code).catch(() => null))?.id;
      if (!jid) throw new UsageError('❌ Link grup order ini tidak valid lagi. Minta pembeli kirim link baru.');
      const all = obj(ctx.db.raw(), 'sewa'); const cur = all[jid];
      all[jid] = { expiresAt: Math.max(cur?.expiresAt || 0, Date.now()) + o.days * DAY, by: o.user, order: o.id, warned: false };
      info = `🏠 Sewa grup aktif sampai ${fmtDate(all[jid].expiresAt, ctx)}`; ensureSewaLoop(ctx.yannajah);
    }
    o.status = 'paid'; o.paidAt = Date.now(); ctx.db.touch();
    await ctx.yannajah.sendmessage(o.chat, { text: `✅ Pembayaran ${o.id} dikonfirmasi!\n${info}`, mentions: [o.user] }).catch(() => {});
    await ctx.reply(`✅ ${o.id} dikonfirmasi. ${info}`);
  } });
