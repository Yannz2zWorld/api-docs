'use strict';
// 2048 versi chat (V15: .2048 / .game2048 / .puzzle2048 berupa game HTML). Geser dengan w/a/s/d
// atau atas/bawah/kiri/kanan. Logika murni (tanpa WhatsApp) supaya bisa dites.
const crypto = require('crypto');

const SIZE = 4;
const empty = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

function addTile(b, rand = n => crypto.randomInt(0, n)) {
  const free = [];
  b.forEach((row, r) => row.forEach((v, c) => { if (!v) free.push([r, c]); }));
  if (!free.length) return b;
  const [r, c] = free[rand(free.length)];
  b[r][c] = rand(10) === 0 ? 4 : 2;
  return b;
}

function newBoard(rand) { return addTile(addTile(empty(), rand), rand); }

// Geser satu baris ke kiri dan gabungkan: [2,2,4,0] -> [4,4,0,0], skor +4.
function slideRow(row) {
  const vals = row.filter(Boolean);
  const out = []; let score = 0;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === vals[i + 1]) { out.push(vals[i] * 2); score += vals[i] * 2; i++; } else out.push(vals[i]);
  }
  while (out.length < SIZE) out.push(0);
  return { row: out, score };
}

const transpose = b => b[0].map((_, c) => b.map(r => r[c]));
const reverse = b => b.map(r => [...r].reverse());
const DIRS = { w: 'up', atas: 'up', up: 'up', s: 'down', bawah: 'down', down: 'down', a: 'left', kiri: 'left', left: 'left', d: 'right', kanan: 'right', right: 'right' };

function move(board, dir) {
  let b = board.map(r => [...r]);
  if (dir === 'up') b = transpose(b); else if (dir === 'down') b = reverse(transpose(b)); else if (dir === 'right') b = reverse(b);
  let score = 0;
  b = b.map(r => { const x = slideRow(r); score += x.score; return x.row; });
  if (dir === 'up') b = transpose(b); else if (dir === 'down') b = transpose(reverse(b)); else if (dir === 'right') b = reverse(b);
  const moved = JSON.stringify(b) !== JSON.stringify(board);
  return { board: b, score, moved };
}

const canMove = b => ['up', 'down', 'left', 'right'].some(d => move(b, d).moved);
const maxTile = b => Math.max(...b.flat());
function render(b) {
  const cell = v => (v ? String(v) : '·').padStart(5, ' ');
  return '```\n' + b.map(r => r.map(cell).join('')).join('\n\n') + '\n```';
}

module.exports = { newBoard, addTile, slideRow, move, canMove, maxTile, render, DIRS };
