'use strict';
// Game lokal tanpa API: kuis matematika, tebak angka, suit, dadu, koin, slot, tictactoe 2 pemain.
const crypto = require('crypto');
const { feature } = require('../../library/plugin-kit');
const games = require('../../library/games');
const { UsageError } = require('../../library/errors');
const { jidUser } = require('../../library/function');

const rnd = (a, b) => crypto.randomInt(a, b + 1);
const busy = ctx => { if (games.get(ctx.m.chat)) throw new UsageError('Masih ada game berjalan di chat ini. Selesaikan atau .nyerah'); };
const reward = (ctx, jid, exp, money) => { const u = ctx.db.user(jid); u.exp = (u.exp || 0) + exp; u.money = (u.money || 0) + money; ctx.db.touch(); };

const MATH_LEVELS = {
  easy: () => { const a = rnd(1, 20), b = rnd(1, 20), op = ['+', '-'][rnd(0, 1)]; return [`${a} ${op} ${b}`, op === '+' ? a + b : a - b]; },
  medium: () => { const a = rnd(2, 15), b = rnd(2, 15), c = rnd(1, 50), op = ['+', '-'][rnd(0, 1)]; return [`${a} × ${b} ${op} ${c}`, op === '+' ? a * b + c : a * b - c]; },
  hard: () => { const b = rnd(2, 12), q = rnd(2, 30), a = b * q, c = rnd(2, 9), d = rnd(2, 9); return [`${a} ÷ ${b} + ${c} × ${d}`, q + c * d]; }
};

function renderBoard(b) {
  const sym = { X: '❌', O: '⭕' };
  return [0, 3, 6].map(r => b.slice(r, r + 3).map((v, i) => sym[v] || ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'][r + i]).join('')).join('\n');
}
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const winner = b => { for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]; return b.every(Boolean) ? 'draw' : null; };

module.exports = [
  feature({ id: 'game.math', name: 'kuismath', aliases: ['math', 'mathquiz'], category: 'game', description: 'Kuis matematika: .kuismath [easy|medium|hard]', usage: '[level]', cooldown: 5,
    async run(ctx) {
      busy(ctx);
      const level = MATH_LEVELS[ctx.args[0]] ? ctx.args[0] : 'easy';
      const [q, ans] = MATH_LEVELS[level]();
      const r = { easy: [10, 100], medium: [20, 200], hard: [40, 400] }[level];
      games.start(ctx.m.chat, { type: 'quiz', name: 'kuismath', answer: String(ans), reward: { exp: r[0], money: r[1] } }, { timeoutMs: 30000, onTimeout: s => ctx.yannajah.sendmessage(ctx.m.chat, { text: `⌛ Waktu habis! Jawaban: *${s.answer}*` }).catch(() => {}) });
      await ctx.reply(`🧮 *${level.toUpperCase()}*: ${q} = ?\n30 detik · hadiah ${r[0]} exp`);
    } }),
  feature({ id: 'game.tebakangka', name: 'tebakangka', category: 'game', description: 'Tebak angka 1-100 dengan petunjuk lebih besar/kecil (7 kesempatan)', cooldown: 5,
    async run(ctx) {
      busy(ctx);
      const target = rnd(1, 100);
      let tries = 0;
      games.start(ctx.m.chat, { type: 'custom', name: 'tebakangka', target, async onAnswer(c, text) {
        const n = Number(String(text).trim());
        if (!Number.isInteger(n)) return false;
        tries++;
        if (n === target) { games.stop(c.m.chat); reward(c, c.m.sender, 20 + (7 - tries) * 5, 200); await c.reply(`🎉 Benar! Angkanya ${target} (${tries} tebakan)`); return true; }
        if (tries >= 7) { games.stop(c.m.chat); await c.reply(`❌ Kesempatan habis. Angkanya ${target}.`); return true; }
        await c.reply(`${n < target ? '⬆️ Lebih besar' : '⬇️ Lebih kecil'} (sisa ${7 - tries})`); return true;
      } }, { timeoutMs: 120000, onTimeout: () => ctx.yannajah.sendmessage(ctx.m.chat, { text: `⌛ Waktu habis! Angkanya ${target}.` }).catch(() => {}) });
      await ctx.reply('🔢 Aku memikirkan angka 1-100. Tebak! (7 kesempatan, 2 menit)');
    } }),
  feature({ id: 'game.suit', name: 'suit', aliases: ['rps'], category: 'game', description: 'Suit melawan bot: .suit batu|gunting|kertas', usage: '<batu|gunting|kertas>',
    pure: (t, _ctx, botPick = ['batu', 'gunting', 'kertas'][rnd(0, 2)]) => {
      const me = String(t || '').trim().toLowerCase();
      if (!['batu', 'gunting', 'kertas'].includes(me)) throw new UsageError('Pilih batu, gunting, atau kertas.');
      const beats = { batu: 'gunting', gunting: 'kertas', kertas: 'batu' };
      const res = me === botPick ? 'Seri 🤝' : beats[me] === botPick ? 'Kamu menang 🎉' : 'Kamu kalah 😝';
      return `Kamu: ${me}\nBot: ${botPick}\n${res}`;
    },
    tests: [{ input: 'batu', expect: o => /Kamu: batu\nBot: (batu|gunting|kertas)\n(Seri|Kamu menang|Kamu kalah)/.test(o) }],
    async run(ctx) { await ctx.reply(this.pure(ctx.text)); } }),
  feature({ id: 'game.dadu', name: 'dadu', aliases: ['dice', 'roll'], category: 'game', description: 'Lempar dadu: .dadu [jumlah dadu] [sisi]', usage: '[n] [sisi]',
    pure: t => { const [n = 1, s = 6] = String(t || '').trim().split(/\s+/).filter(Boolean).map(Number); if (!(n >= 1 && n <= 10 && s >= 2 && s <= 100)) throw new UsageError('1-10 dadu, 2-100 sisi.'); const r = Array.from({ length: n }, () => rnd(1, s)); return `🎲 ${r.join(' + ')}${n > 1 ? ` = ${r.reduce((a, b) => a + b, 0)}` : ''}`; },
    tests: [{ input: '3 6', expect: /^🎲 [1-6] \+ [1-6] \+ [1-6] = \d+$/ }],
    async run(ctx) { await ctx.reply(this.pure(ctx.text)); } }),
  feature({ id: 'game.koin', name: 'koin', aliases: ['coinflip', 'flip'], category: 'game', description: 'Lempar koin (angka/gambar)',
    pure: () => (rnd(0, 1) ? '🪙 Angka' : '🪙 Gambar'), tests: [{ input: '', expect: /^🪙 (Angka|Gambar)$/ }],
    async run(ctx) { await ctx.reply(this.pure()); } }),
  feature({ id: 'game.slot', name: 'slot', category: 'game', description: 'Mesin slot memakai saldo: .slot <taruhan>', usage: '<taruhan>', cooldown: 5,
    async run(ctx) {
      const bet = Number(ctx.args[0]);
      if (!Number.isInteger(bet) || bet < 10 || bet > 100000) throw new UsageError('Taruhan 10 - 100.000 saldo.');
      const u = ctx.user;
      if ((u.money || 0) < bet) throw new UsageError(`Saldo kurang. Saldo kamu: ${u.money || 0}`);
      const sym = ['🍒', '🍋', '🍇', '🔔', '⭐', '💎'];
      const r = [0, 1, 2].map(() => sym[rnd(0, sym.length - 1)]);
      const mult = r[0] === r[1] && r[1] === r[2] ? (r[0] === '💎' ? 10 : 5) : r[0] === r[1] || r[1] === r[2] || r[0] === r[2] ? 1.5 : 0;
      const win = Math.floor(bet * mult);
      u.money = u.money - bet + win; ctx.db.touch();
      await ctx.reply(`🎰 | ${r.join(' | ')} |\n${mult ? `Menang ${win} (x${mult})` : `Kalah ${bet}`}\nSaldo: ${u.money}`);
    } }),
  feature({ id: 'game.tictactoe', name: 'tictactoe', aliases: ['ttt'], category: 'game', scope: 'group', description: 'Tictactoe 2 pemain: .tictactoe @lawan, lalu kirim angka 1-9', usage: '@lawan', cooldown: 5,
    async run(ctx) {
      busy(ctx);
      const opp = ctx.m.mentionedJid?.[0] || ctx.m.quoted?.sender;
      if (!opp || opp === ctx.m.sender) throw new UsageError('Tag lawanmu: .tictactoe @teman');
      const board = Array(9).fill(null);
      const players = { X: ctx.m.sender, O: opp };
      let turn = 'X';
      games.start(ctx.m.chat, { type: 'custom', name: 'tictactoe', async onAnswer(c, text) {
        if (!/^[1-9]$/.test(String(text).trim())) return false;
        if (c.m.sender !== players[turn]) return false;
        const i = Number(text) - 1;
        if (board[i]) { await c.reply('Kotak sudah terisi.'); return true; }
        board[i] = turn;
        const w = winner(board);
        if (w) {
          games.stop(c.m.chat);
          if (w !== 'draw') reward(c, players[w], 50, 500);
          await c.yannajah.sendmessage(c.m.chat, { text: `${renderBoard(board)}\n\n${w === 'draw' ? 'Seri! 🤝' : `🏆 @${jidUser(players[w])} menang! (+50 exp)`}`, mentions: Object.values(players) });
          return true;
        }
        turn = turn === 'X' ? 'O' : 'X';
        await c.yannajah.sendmessage(c.m.chat, { text: `${renderBoard(board)}\n\nGiliran @${jidUser(players[turn])} (${turn === 'X' ? '❌' : '⭕'})`, mentions: [players[turn]] });
        return true;
      } }, { timeoutMs: 5 * 60000, onTimeout: () => ctx.yannajah.sendmessage(ctx.m.chat, { text: '⌛ Tictactoe dibatalkan (tidak ada langkah 5 menit).' }).catch(() => {}) });
      await ctx.yannajah.sendmessage(ctx.m.chat, { text: `🎮 TICTACTOE\n❌ @${jidUser(players.X)} vs ⭕ @${jidUser(players.O)}\n\n${renderBoard(board)}\n\nGiliran @${jidUser(players.X)} — kirim angka 1-9`, mentions: Object.values(players) });
    } })
];
module.exports.winner = winner;
