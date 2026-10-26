'use strict';
const { feature } = require('../../library/plugin-kit');
const games = require('../../lib/game');
const { UsageError } = require('../../library/errors');
const { jidUser } = require('../../library/function');
const { busy, renderBoard, reward, winner } = require('../../lib/minigame');

module.exports = feature({ id: 'game.tictactoe', name: 'tictactoe', aliases: ['ttt', 'tictactoe2', 'tictactoerich'], category: 'game', scope: 'group', description: 'Tictactoe 2 pemain: .tictactoe @lawan, lalu kirim angka 1-9', usage: '@lawan', cooldown: 5,
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
  } });
