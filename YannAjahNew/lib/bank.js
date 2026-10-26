'use strict';
// Ekonomi V15: bank (deposit/withdraw), casino 50/50, leaderboard, owner add/set/del money,
// tukar koin -> premium / sewa grup. Mata uang = saldo user (u.money, sama dengan .saldo/.kerja).
// Koin virtual, tidak bisa dicairkan ke uang sungguhan.
const crypto = require('crypto');
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const { targetJid, mention } = require('../library/targets');

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

module.exports = { E, fmt, CASINO_MIN, EXCHANGE, DAY, parseAmount, wealth, board, ownerMoney };
