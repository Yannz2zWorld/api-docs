'use strict';
// TTS Brando (V15: .ttsbrando) — ubah teks jadi suara. API: api-faa.my.id (tanpa key).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const extapi = require('../../lib/extapi');

module.exports = feature({
  id: 'ai.ttsbrando', name: 'ttsbrando', category: 'ai', cooldown: 5, limit: 1,
  description: 'Text-to-speech suara "Brando"', usage: '<teks>',
  params: [{ name: 'text', required: true }], dependencies: { apis: ['faa'] },
  async run(ctx) {
    const text = (ctx.text || ctx.m.quoted?.text || '').trim();
    if (!text) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} halo semuanya`);
    await ctx.react('⏳');
    const r = await extapi.get(ctx, `${ctx.config.extapi.faa}/faa/tts-brando?text=${encodeURIComponent(text)}`);
    if (!r || !r.status || !r.url) throw new UsageError('Gagal membuat audio TTS.');
    await ctx.sendFile(r.url, { mimetype: 'audio/mpeg' });
  }
});
