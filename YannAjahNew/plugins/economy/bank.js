'use strict';
// Ekonomi V15: bank (deposit/withdraw), casino 50/50, leaderboard, owner add/set/del money,
// tukar koin -> premium / sewa grup. Mata uang = saldo user (u.money, sama dengan .saldo/.kerja).
// Koin virtual, tidak bisa dicairkan ke uang sungguhan.
const crypto = require('crypto');
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { targetJid, mention } = require('../../library/targets');

const E = f => feature({ category: 'economy', cooldown: 3, ...f });
const fmt = n => Number(n || 0).toLocaleString('id-ID');
const CASINO_MIN = 10000;
const EXCHANGE = { premium: 75000, sewagc: 100000 };   // koin per hari (V15)
const DAY = 86400000;

// "1000", "1.000", "1k", "2,5jt", "all"
function parseAmount(s, all = null) {
  const t = String(s || '').toLowerCase().replace(/\s/g, '');
  if (t === 'all' || t === 'semua') return all;
  const m = /^(\d+(?:[.,]\d+)*)(k|rb|jt|m)?$/.exec(t);
  if (!m) return NaN;
  const n = Number(m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  return Math.floor(n * ({ k: 1e3, rb: 1e3, jt: 1e6, m: 1e6 }[m[2]] || 1));
}
const wealth = u => (u.money || 0) + (u.bank || 0);

function board(ctx, title) {
  const rows = Object.entries(ctx.db.raw().users).map(([j, u]) => [j, wealth(u)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!rows.length) throw new UsageError('📊 Belum ada data koin.');
  const medal = ['🥇', '🥈', '🥉'];
  return `╭─ᶻ 𝘇 𐰁 🏆 *${title}*\n│\n${rows.map(([j, v], i) => `│ ${medal[i] || `${i + 1}.`} ${mention(j)} — ${fmt(v)} koin`).join('\n')}\n╰──────────`;
}

const ownerMoney = (name, verb, apply) => E({
  id: `economy.${name}`, name, category: 'owner', permission: 'owner', allowInMaintenance: true, usage: '<@tag|nomor> <jumlah>',
  description: `${verb} koin user`,
  async run(ctx) {
    const j = targetJid(ctx); const n = parseAmount(ctx.args.find(a => /^\d/.test(a) && a.replace(/\D/g, '') !== j.split('@')[0]));
    if (!Number.isFinite(n) || n < 0 || n > 1e12) throw new UsageError(ctx.usage());
    const u = ctx.db.user(j); apply(u, n); ctx.db.touch();
    await ctx.reply(`✅ Koin ${mention(j)} sekarang *${fmt(u.money)}*.`);
  }
});

module.exports = [
  E({ id: 'economy.bank', name: 'bank', description: 'Bank koin: .bank | .bank deposit <jumlah|all> | .bank withdraw <jumlah|all>', usage: '[deposit|withdraw] [jumlah]',
    async run(ctx) {
      const u = ctx.user; u.money = u.money || 0; u.bank = u.bank || 0;
      const sub = (ctx.args[0] || '').toLowerCase();
      if (['deposit', 'dep', 'setor'].includes(sub)) {
        const n = parseAmount(ctx.args[1], u.money);
        if (!(n > 0)) throw new UsageError('❌ Masukkan jumlah yang valid!\nContoh: .bank deposit 1000');
        if (n > u.money) throw new UsageError(`❌ Koin di tangan tidak cukup! (${fmt(u.money)})`);
        u.money -= n; u.bank += n; ctx.db.touch();
        return ctx.reply(`✅ *Deposit Berhasil!*\n│ 💸 Disetor : *${fmt(n)}* koin\n│ 🏦 Bank : *${fmt(u.bank)}* koin\n│ 💰 Di Tangan : *${fmt(u.money)}* koin\n╰──`);
      }
      if (['withdraw', 'wd', 'tarik'].includes(sub)) {
        const n = parseAmount(ctx.args[1], u.bank);
        if (!(n > 0)) throw new UsageError('❌ Masukkan jumlah yang valid!\nContoh: .bank withdraw 500');
        if (n > u.bank) throw new UsageError(`❌ Saldo bank tidak cukup! (${fmt(u.bank)})`);
        u.bank -= n; u.money += n; ctx.db.touch();
        return ctx.reply(`✅ *Withdraw Berhasil!*\n│ 💸 Ditarik : *${fmt(n)}* koin\n│ 🏦 Bank : *${fmt(u.bank)}* koin\n│ 💰 Di Tangan : *${fmt(u.money)}* koin\n╰──`);
      }
      await ctx.reply(`╭─ᶻ 𝘇 𐰁 *Info Bank*\n│ 🏦 Saldo Bank : *${fmt(u.bank)}* koin\n│ 💰 Di Tangan : *${fmt(u.money)}* koin\n│ 💎 Total Aset : *${fmt(wealth(u))}* koin\n╰──────────\n• .bank deposit 1000\n• .bank withdraw 500`);
    } }),
  E({ id: 'economy.casino', name: 'casino', description: `Taruhan koin 50/50 (menang = 2x). Minimal ${fmt(CASINO_MIN)} koin`, usage: '<taruhan|all>', cooldown: 10,
    async run(ctx) {
      const u = ctx.user; u.money = u.money || 0;
      const bet = parseAmount(ctx.args[0], u.money);
      if (!(bet > 0)) return ctx.reply(`🎲 *CASINO*\n\nContoh: .casino 10000\n• Menang → uang kamu *2x*\n• Kalah → taruhan hangus\n• Taruhan minimal: ${fmt(CASINO_MIN)} koin`);
      if (bet < CASINO_MIN) throw new UsageError(`❌ Taruhan minimal *${fmt(CASINO_MIN)} koin*!`);
      if (u.money < bet) throw new UsageError(`❌ Koin tidak cukup! Koin kamu: *${fmt(u.money)}*`);
      const d1 = crypto.randomInt(1, 7), d2 = crypto.randomInt(1, 7); const win = crypto.randomInt(0, 2) === 1;
      u.money += win ? bet : -bet; ctx.db.touch();
      const face = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      await ctx.reply(`🎲 *CASINO*\n${face[d1]} + ${face[d2]} = *${d1 + d2}* (${(d1 + d2) % 2 ? 'Ganjil' : 'Genap'})\n\n${win ? '✅ *MENANG!*' : '❌ *KALAH!*'}\n\n💸 Taruhan : *${fmt(bet)}* koin\n${win ? '🏆 Untung' : '📉 Rugi'} : *${win ? '+' : '-'}${fmt(bet)}* koin\n💰 Koin : *${fmt(u.money)}*`);
    } }),
  E({ id: 'economy.topbalance', name: 'topbalance', aliases: ['topmoney', 'lbmoney', 'moneylb', 'leaderboardmoney'], description: 'Top 10 terkaya (koin + bank)',
    async run(ctx) { await ctx.reply(board(ctx, 'TOP BALANCE')); } }),
  ownerMoney('addmoney', 'Tambah', (u, n) => { u.money = (u.money || 0) + n; }),
  ownerMoney('setmoney', 'Atur', (u, n) => { u.money = n; }),
  ownerMoney('delmoney', 'Kurangi', (u, n) => { u.money = Math.max(0, (u.money || 0) - n); }),
  E({ id: 'economy.exchange', name: 'tukarkoin', aliases: ['exchange', 'tukaruang'], description: `Tukar koin: premium (${fmt(EXCHANGE.premium)}/hari) atau sewagc (${fmt(EXCHANGE.sewagc)}/hari, di grup)`, usage: '<premium|sewagc> <hari>', cooldown: 10,
    async run(ctx) {
      const [item, d] = [String(ctx.args[0] || '').toLowerCase(), Number(ctx.args[1] || 1)];
      const u = ctx.user; u.money = u.money || 0;
      if (!EXCHANGE[item]) return ctx.reply(`╭─ᶻ 𝘇 𐰁 💱 *Tukar Koin*\n│ Saldo kamu : ${fmt(u.money)} koin\n│ • premium : ${fmt(EXCHANGE.premium)} koin / hari\n│ • sewagc : ${fmt(EXCHANGE.sewagc)} koin / hari\n╰──\nContoh: .tukarkoin premium 3`);
      if (!Number.isInteger(d) || d < 1 || d > 365) throw new UsageError('Hari 1-365.');
      if (item === 'sewagc' && !ctx.m.isGroup) throw new UsageError('Tukar sewa grup dilakukan di grup yang mau disewa.');
      const cost = EXCHANGE[item] * d;
      if (u.money < cost) throw new UsageError(`❌ Koin kurang. Butuh ${fmt(cost)}, kamu punya ${fmt(u.money)}.`);
      u.money -= cost;
      let info;
      if (item === 'premium') { u.premiumUntil = Math.max(u.premiumUntil || 0, Date.now()) + d * DAY; info = `💎 Premium sampai ${new Date(u.premiumUntil).toLocaleString('id-ID', { timeZone: ctx.config.bot.timezone })}`; }
      else { const all = ctx.db.raw().sewa = ctx.db.raw().sewa || {}; const cur = all[ctx.m.chat]; all[ctx.m.chat] = { expiresAt: Math.max(cur?.expiresAt || 0, Date.now()) + d * DAY, by: ctx.m.sender, warned: false }; info = `🏠 Sewa grup sampai ${new Date(all[ctx.m.chat].expiresAt).toLocaleString('id-ID', { timeZone: ctx.config.bot.timezone })}`; }
      ctx.db.touch();
      await ctx.reply(`✅ Tukar berhasil (-${fmt(cost)} koin)\n${info}\nSisa koin: ${fmt(u.money)}`);
    } })
];
module.exports._internal = { parseAmount };
