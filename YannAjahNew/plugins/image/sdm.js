'use strict';
// SDM — edit foto jadi gaya glitch cyberpunk (V15: .sdm). Lewat APIZ2Z nano-banana (upload gambar).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { sendResult } = require('../../lib/apiz2z-kit');

const PROMPT = 'edit the uploaded photo into a dark glitch cyberpunk aesthetic, keep the same person and pose, high contrast, neon glitch, cinematic lighting';

module.exports = feature({
  id: 'image.sdm', name: 'sdm', category: 'image', cooldown: 10, limit: 1,
  description: 'Edit foto jadi gaya glitch cyberpunk (AI)', usage: '(reply gambar)',
  dependencies: { apiz2z: '/api/ai/nano-banana' },
  async run(ctx) {
    const md = ctx.media();
    if (!md || !/^image\//.test(md.mime)) throw new UsageError(`Reply gambar dengan caption ${ctx.prefix}${ctx.command}`);
    await ctx.react('⏳');
    const result = await ctx.api.post('/api/ai/nano-banana', { prompt: PROMPT, mode: 'edit' }, { buffer: await md.download(), mime: md.mime });
    await sendResult(ctx, result, { title: 'SDM Glitch Cyberpunk', category: 'image', caption: '╭─ *Style* : Glitch Cyberpunk' });
    await ctx.react('✅');
  }
});
