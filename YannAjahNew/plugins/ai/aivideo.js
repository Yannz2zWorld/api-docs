'use strict';
// AI Video Generator (V15: .sora / .veo3 / .ailabs / .aivideo / .buatvideo / .genvideo). Premium.
// STATUS: IMPLEMENTED — NOT TESTED (provider pihak ketiga, lihat lib/aivideo.js & DAFTAR-API.txt).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const aivideo = require('../../lib/aivideo');

module.exports = feature({
  id: 'ai.aivideo', name: 'aivideo', aliases: ['sora', 'soraai', 'veo3', 'ailabs', 'buatvideo', 'genvideo'],
  category: 'ai', permission: 'premium', cooldown: 20, limit: 1,
  description: 'Bikin video dari teks (text-to-video)', usage: '<prompt>',
  params: [{ name: 'prompt', required: true }], dependencies: { apis: ['t2v'] },
  async run(ctx) {
    const prompt = (ctx.text || '').trim();
    if (!prompt) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} kucing berlari di pantai saat senja`);
    await ctx.react('⏳');
    await ctx.reply(ctx.config.mess.wait);
    const { buffer } = await aivideo.generate(prompt, { aspectRatio: '16:9', aiSound: 1 });
    await ctx.sendFile(buffer, { mimetype: 'video/mp4', caption: `🎬 *AI Video*\nPrompt: ${prompt}\n© ${ctx.config.bot.name}` });
    await ctx.react('✅');
  }
});
