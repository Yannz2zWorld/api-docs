'use strict';
const { feature } = require('../../library/plugin-kit');
const games = require('../../lib/game');
const { busy, reward, rnd } = require('../../lib/minigame');

module.exports = feature({ id: 'game.tebakangka', name: 'tebakangka', category: 'game', description: 'Tebak angka 1-100 dengan petunjuk lebih besar/kecil (7 kesempatan)', cooldown: 5,
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
  } });
