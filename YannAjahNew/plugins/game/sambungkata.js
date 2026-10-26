'use strict';
// Sambung Kata (V15) — bot kasih kata, pemain balas kata yang diawali huruf terakhir, tidak boleh
// mengulang. Kamus dari data/game/sambungkata.json (pasangan kata valid). Jawab dengan reply/kirim teks.
const path = require('path');
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const games = require('../../lib/game');

const DATA = require(path.join(__dirname, '..', '..', 'data', 'game', 'sambungkata.json'));
// Kumpulan kata valid (soal + jawaban), huruf kecil, hanya a-z.
const WORDS = new Set();
for (const it of DATA) for (const w of [it.soal, it.jawaban]) { const s = String(w || '').toLowerCase().trim(); if (/^[a-z]{3,}$/.test(s)) WORDS.add(s); }
const BY_FIRST = {};
for (const w of WORDS) (BY_FIRST[w[0]] = BY_FIRST[w[0]] || []).push(w);
const pick = a => a[Math.floor(Math.random() * a.length)];
const lastLetter = w => w[w.length - 1];
const TIMEOUT = 60000;

module.exports = feature({
  id: 'game.sambungkata', name: 'sambungkata', aliases: ['sambungkata2'], category: 'game', scope: 'all', cooldown: 5, limit: 1,
  description: `Sambung kata (${WORDS.size} kata)`, dataset: 'data/game/sambungkata.json',
  async run(ctx) {
    if (games.get(ctx.m.chat)) throw new UsageError('Masih ada game berjalan di chat ini. Ketik .nyerah untuk berhenti.');
    const start = pick([...WORDS]);
    const session = {
      type: 'custom', name: 'sambungkata', used: new Set([start]), current: start, score: 0,
      async onAnswer(c, text) {
        const g = games.get(c.m.chat); if (!g) return false;
        const w = String(text || '').toLowerCase().trim();
        if (!/^[a-z]+$/.test(w)) return false;
        const need = lastLetter(g.current);
        if (w[0] !== need) { await c.reply(`❌ Harus diawali huruf *${need.toUpperCase()}*. Kata sekarang: *${g.current}*`); return true; }
        if (g.used.has(w)) { await c.reply(`❌ Kata *${w}* sudah dipakai. Cari yang lain.`); return true; }
        if (w.length < 3 || !WORDS.has(w)) { await c.reply(`❌ *${w}* tidak ada di kamus permainan. Coba kata lain.`); return true; }
        g.used.add(w); g.score++;
        const next = (BY_FIRST[lastLetter(w)] || []).filter(x => !g.used.has(x));
        if (!next.length) { games.stop(c.m.chat); await c.reply(`🏆 Hebat! Bot kehabisan kata. Skormu *${g.score}*.`); return true; }
        const botWord = pick(next); g.used.add(botWord); g.current = botWord;
        clearTimeout(g.timer); g.timer = setTimeout(() => { if (games.get(c.m.chat) === g) { games.stop(c.m.chat); c.yannajah.sendmessage(c.m.chat, { text: `⌛ Waktu habis! Skor akhir: *${g.score}*` }).catch(() => {}); } }, TIMEOUT); g.timer.unref?.();
        await c.reply(`🔤 *${botWord}*\nSambung dengan kata berawalan *${lastLetter(botWord).toUpperCase()}* (skor: ${g.score})`);
        return true;
      }
    };
    games.start(ctx.m.chat, session, { timeoutMs: TIMEOUT, onTimeout: s => ctx.yannajah.sendmessage(ctx.m.chat, { text: `⌛ Waktu habis! Skor akhir: *${s.score}*` }).catch(() => {}) });
    await ctx.reply(`🎮 *SAMBUNG KATA*\nKata: *${start}*\nBalas dengan kata berawalan *${lastLetter(start).toUpperCase()}* (min 3 huruf, tidak mengulang).\n⏱️ ${TIMEOUT / 1000} detik · .nyerah untuk berhenti`);
  }
});
