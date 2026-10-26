'use strict';
// Tebak JKT48 — soal diambil live dari API siputzx (V15: case 'tebakjkt'). Jawab dengan membalas teks.
// Tidak pakai dataset lokal karena soalnya dari API; kalau API mati, fitur menolak dengan pesan jelas.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const games = require('../../lib/game');
const extapi = require('../../lib/extapi');

const TIMEOUT = 60000;
const REWARD = { exp: 30, money: 300 };

module.exports = feature({
  id: 'game.tebakjkt', name: 'tebakjkt', category: 'game', cooldown: 5, limit: 1,
  description: 'Tebak member JKT48 dari gambar (soal dari API siputzx)',
  dependencies: { apis: ['siputzx'] },
  async run(ctx) {
    if (games.get(ctx.m.chat)) throw new UsageError('Masih ada game yang berjalan di chat ini. Jawab dulu atau ketik .nyerah');
    const res = await extapi.get(ctx, `${ctx.config.extapi.siputzx}/api/games/tebakjkt`, { timeoutMs: 30000 }).catch(() => null);
    const d = res && res.status ? res.data : null;
    if (!d || !(d.jawaban || d.name)) throw new UsageError('Soal tebak JKT48 lagi tidak tersedia, coba lagi nanti.');
    const answer = String(d.jawaban || d.name).trim();
    games.start(ctx.m.chat, { type: 'quiz', name: 'tebakjkt', answer, reward: { ...REWARD } }, {
      timeoutMs: TIMEOUT,
      onTimeout: s => ctx.yannajah.sendmessage(ctx.m.chat, { text: `⌛ Waktu habis! Jawabannya: *${s.answer}*` }).catch(() => {})
    });
    const caption = `🎮 *TEBAKJKT*\nTebak member JKT48 pada gambar!\n\n⏱️ ${TIMEOUT / 1000} detik · hadiah ${REWARD.exp} exp + ${REWARD.money} saldo\nBalas dengan jawabanmu · .hint · .nyerah`;
    if (d.img || d.gambar) await ctx.sendFile(d.img || d.gambar, { caption }).catch(() => ctx.reply(caption));
    else await ctx.reply(caption);
  }
});
