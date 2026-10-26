'use strict';
// V15: jawab lewat command (.jawabkuis, .jawabtebak, .jawabteka, .jawabasah, .jawab).
const { feature } = require('../../library/plugin-kit');
const games = require('../../lib/game');
const { UsageError } = require('../../library/errors');
const { answer } = require('../../lib/tebak');

module.exports = feature({ id: 'game.jawab', name: 'jawab', aliases: ['jawabkuis', 'jawabtebak', 'jawabteka', 'jawabasah'], category: 'game', description: 'Jawab game yang sedang berjalan (bisa juga langsung balas teks)', usage: '<jawaban>',
  async run(ctx) {
    const s = games.get(ctx.m.chat);
    if (!s) throw new UsageError('⚠️ Belum ada soal aktif. Mulai dulu, mis. .kuis / .tebakkah / .tekateki');
    if (!(await answer(ctx, ctx.requireText('Ketik jawabanmu: .jawab <jawaban>')))) await ctx.reply(s.type === 'quiz' ? `❌ *Salah!* Clue: jawabannya ${String(s.answer).length} huruf.` : '❌ Salah!');
  } });
