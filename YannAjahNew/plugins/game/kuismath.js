'use strict';
const { feature } = require('../../library/plugin-kit');
const games = require('../../lib/game');
const { MATH_LEVELS, busy } = require('../../lib/minigame');

module.exports = feature({ id: 'game.math', name: 'kuismath', aliases: ['math', 'mathquiz', 'mathchallenge'], category: 'game', description: 'Kuis matematika: .kuismath [easy|medium|hard]', usage: '[level]', cooldown: 5,
  async run(ctx) {
    busy(ctx);
    const level = MATH_LEVELS[ctx.args[0]] ? ctx.args[0] : 'easy';
    const [q, ans] = MATH_LEVELS[level]();
    const r = { easy: [10, 100], medium: [20, 200], hard: [40, 400] }[level];
    games.start(ctx.m.chat, { type: 'quiz', name: 'kuismath', answer: String(ans), reward: { exp: r[0], money: r[1] } }, { timeoutMs: 30000, onTimeout: s => ctx.yannajah.sendmessage(ctx.m.chat, { text: `⌛ Waktu habis! Jawaban: *${s.answer}*` }).catch(() => {}) });
    await ctx.reply(`🧮 *${level.toUpperCase()}*: ${q} = ?\n30 detik · hadiah ${r[0]} exp`);
  } });
