'use strict';
// Game lokal tanpa API: kuis matematika, tebak angka, suit, dadu, koin, slot, tictactoe 2 pemain.
const crypto = require('crypto');
const { feature } = require('../library/plugin-kit');
const games = require('./game');
const { UsageError } = require('../library/errors');
const { jidUser } = require('../library/function');

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

module.exports = { rnd, busy, reward, MATH_LEVELS, renderBoard, winner };
