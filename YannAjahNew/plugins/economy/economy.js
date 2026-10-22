'use strict';
// Ekonomi virtual (saldo dalam bot, bukan uang sungguhan): saldo, kerja, transfer, papan peringkat.
const crypto = require('crypto');
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { jidUser, normalizePhone, toJid } = require('../../library/function');

const E = f => feature({ category: 'economy', ...f });
const JOBS = ['ojek online', 'barista', 'programmer freelance', 'kurir paket', 'penjual bakso', 'desainer grafis', 'guru les', 'admin toko online'];

module.exports = [
  E({ id: 'economy.saldo', name: 'saldo', aliases: ['balance', 'bal', 'dompet'], description: 'Cek saldo virtual kamu (atau @user)',
    async run(ctx) { const j = ctx.m.mentionedJid?.[0] || ctx.m.sender; const u = ctx.db.user(j); await ctx.reply(`💰 Saldo @${jidUser(j)}: *${(u.money || 0).toLocaleString('id-ID')}*`); } }),
  E({ id: 'economy.kerja', name: 'kerja', aliases: ['work'], description: 'Bekerja untuk mendapat saldo (sekali per jam)', cooldown: 3,
    async run(ctx) {
      const u = ctx.user;
      const wait = (u.lastWork || 0) + 3600000 - Date.now();
      if (wait > 0) throw new UsageError(`Kamu masih capek. Bisa kerja lagi ${Math.ceil(wait / 60000)} menit lagi.`);
      const earn = crypto.randomInt(200, 1201);
      u.lastWork = Date.now(); u.money = (u.money || 0) + earn; u.exp = (u.exp || 0) + 10; ctx.db.touch();
      await ctx.reply(`💼 Kamu bekerja sebagai ${JOBS[crypto.randomInt(0, JOBS.length)]} dan mendapat *${earn}* saldo (+10 exp).`);
    } }),
  E({ id: 'economy.transfer', name: 'transfer', aliases: ['tf'], description: 'Kirim saldo virtual: .transfer @user jumlah', usage: '@user <jumlah>', cooldown: 5,
    async run(ctx) {
      const to = ctx.m.mentionedJid?.[0] || ctx.m.quoted?.sender || (normalizePhone(ctx.args[0] || '') && toJid(normalizePhone(ctx.args[0])));
      const amount = Number(ctx.args.find(a => /^\d+$/.test(a) && !(to && a === jidUser(to))));
      if (!to || to === ctx.m.sender) throw new UsageError(ctx.usage());
      if (!Number.isInteger(amount) || amount < 1 || amount > 1e9) throw new UsageError('Jumlah tidak valid.');
      const from = ctx.user;
      if ((from.money || 0) < amount) throw new UsageError(`Saldo kurang (${from.money || 0}).`);
      const dest = ctx.db.user(to);
      from.money -= amount; dest.money = (dest.money || 0) + amount; ctx.db.touch();
      await ctx.reply(`✅ Transfer ${amount.toLocaleString('id-ID')} ke @${jidUser(to)} berhasil. Sisa saldo: ${from.money.toLocaleString('id-ID')}`);
    } }),
  E({ id: 'economy.top', name: 'topsaldo', aliases: ['leaderboard', 'lb', 'richest'], description: '10 besar saldo',
    async run(ctx) { const top = Object.entries(ctx.db.raw().users).filter(([, u]) => u.money > 0).sort((a, b) => b[1].money - a[1].money).slice(0, 10); await ctx.reply(top.length ? `🏆 *Top saldo*\n${top.map(([j, u], i) => `${i + 1}. ${u.name || jidUser(j).slice(0, 5) + '…'} — ${u.money.toLocaleString('id-ID')}`).join('\n')}` : 'Belum ada data.'); } }),
  E({ id: 'economy.topexp', name: 'toplevel', aliases: ['topexp'], description: '10 besar exp',
    async run(ctx) { const top = Object.entries(ctx.db.raw().users).filter(([, u]) => u.exp > 0).sort((a, b) => b[1].exp - a[1].exp).slice(0, 10); await ctx.reply(top.length ? `🏆 *Top exp*\n${top.map(([j, u], i) => `${i + 1}. ${u.name || jidUser(j).slice(0, 5) + '…'} — ${u.exp} exp (lv ${u.level || 0})`).join('\n')}` : 'Belum ada data.'); } }),
  E({ id: 'economy.buylimit', name: 'buylimit', aliases: ['tukarlimit'], description: 'Tukar saldo virtual dengan limit (1 limit = 500 saldo)', usage: '<jumlah>',
    async run(ctx) { const n = Number(ctx.args[0]); if (!Number.isInteger(n) || n < 1 || n > 100) throw new UsageError('Jumlah 1-100.'); const cost = n * 500; if ((ctx.user.money || 0) < cost) throw new UsageError(`Butuh ${cost} saldo.`); ctx.user.money -= cost; ctx.user.limit += n; ctx.db.touch(); await ctx.reply(`✅ +${n} limit (−${cost} saldo).`); } })
];
