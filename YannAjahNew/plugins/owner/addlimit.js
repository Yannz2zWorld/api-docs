'use strict';
const { UsageError } = require('../../library/errors');
const { toJid } = require('../../library/function');
const { O, targetNumber } = require('../../lib/owner');

module.exports = O({ id: 'owner.addlimit', name: 'addlimit', description: 'Tambah limit user: .addlimit <nomor/@tag> <jumlah>', usage: '<nomor/@tag> <jumlah>',
  async run(ctx) { const n = targetNumber(ctx); const k = Number(ctx.args.find(a => /^\d{1,5}$/.test(a) && a !== n)); if (!k) throw new UsageError(ctx.usage()); const u = ctx.db.user(toJid(n)); u.limit += k; ctx.db.touch(); await ctx.reply(`✅ Limit ${n} sekarang ${u.limit}.`); } });
