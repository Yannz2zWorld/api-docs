'use strict';
const { feature } = require('../../library/plugin-kit');
const games = require('../../lib/game');
const { busy, reward } = require('../../lib/minigame');
const g2048 = require('../../lib/game2048');

const HELP = 'Geser: *w* (atas) *a* (kiri) *s* (bawah) *d* (kanan) — atau ketik atas/bawah/kiri/kanan. Keluar: .nyerah';

module.exports = feature({ id: 'game.2048', name: 'game2048', aliases: ['2048', 'puzzle2048'], category: 'game', description: 'Game 2048 di chat: gabungkan angka sampai 2048', cooldown: 5,
  async run(ctx) {
    busy(ctx);
    const player = ctx.m.sender;
    const st = { board: g2048.newBoard(), score: 0, moves: 0 };
    games.start(ctx.m.chat, { type: 'custom', name: '2048', async onAnswer(c, text) {
      const dir = g2048.DIRS[String(text).trim().toLowerCase()];
      if (!dir || c.m.sender !== player) return false;
      const r = g2048.move(st.board, dir);
      if (!r.moved) { await c.reply('Tidak bisa digeser ke arah itu.'); return true; }
      st.board = g2048.addTile(r.board); st.score += r.score; st.moves++;
      const top = g2048.maxTile(st.board);
      if (top >= 2048 || !g2048.canMove(st.board)) {
        games.stop(c.m.chat);
        const win = top >= 2048;
        reward(c, player, win ? 300 : Math.min(100, Math.floor(st.score / 50)), win ? 3000 : st.score);
        await c.reply(`${g2048.render(st.board)}\n${win ? '🏆 2048 tercapai! Kamu menang!' : '💀 Game over, tidak ada langkah lagi.'}\nSkor: *${st.score}* · Langkah: ${st.moves} · Ubin tertinggi: ${top}`);
        return true;
      }
      await c.reply(`${g2048.render(st.board)}\nSkor: *${st.score}* · Ubin tertinggi: ${top}`);
      return true;
    } }, { timeoutMs: 10 * 60000, onTimeout: () => ctx.reply(`⏰ Game 2048 berakhir (10 menit tanpa langkah). Skor: ${st.score}`).catch(() => {}) });
    await ctx.reply(`🔢 *2048*\n${g2048.render(st.board)}\n${HELP}`);
  } });
