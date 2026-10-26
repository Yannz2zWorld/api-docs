'use strict';
// Hook: cek jawaban dari pesan biasa (bukan command).
const { feature } = require('../../library/plugin-kit');
const games = require('../../lib/game');
const { answer } = require('../../lib/tebak');

module.exports = feature({ id: 'game.answer', name: 'gamestatus', category: 'game', description: 'Status game yang sedang berjalan di chat ini',
  async run(ctx) { const s = games.get(ctx.m.chat); await ctx.reply(s ? `Game aktif: ${s.name} (${Math.round((Date.now() - s.startedAt) / 1000)} detik)` : 'Tidak ada game aktif.'); },
  async onMessage(ctx) { return ctx.m.isCmd || !ctx.m.body ? false : answer(ctx, ctx.m.body); } });
