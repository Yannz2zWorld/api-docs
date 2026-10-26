'use strict';
// Copilot Voice (V15: .copilotvoice) — teks jadi suara (voice "dylan") lewat API Alip. Butuh ALIP_API_KEY.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const extapi = require('../../lib/extapi');

module.exports = feature({
  id: 'ai.copilotvoice', name: 'copilotvoice', category: 'ai', cooldown: 5, limit: 1,
  description: 'Text-to-speech voice "dylan" (API Alip)', usage: '<teks>',
  params: [{ name: 'text', required: true }], dependencies: { apis: ['alip'], needsKey: 'ALIP_API_KEY' },
  async run(ctx) {
    const { url, key } = ctx.config.extapi.alip;
    if (!key) throw new UsageError('Fitur ini butuh API Alip. Owner isi ALIP_API_KEY di .env.');
    const text = (ctx.text || ctx.m.quoted?.text || '').trim();
    if (!text) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} halo apa kabar`);
    await ctx.react('⏳');
    const r = await extapi.get(ctx, `${url}/tools/text-to-speech?apikey=${encodeURIComponent(key)}&text=${encodeURIComponent(text)}&voice=dylan`);
    const audioUrl = r?.result?.audio;
    if (!r?.status || !audioUrl) throw new UsageError('Gagal membuat audio TTS.');
    await ctx.sendFile(audioUrl, { mimetype: 'audio/ogg; codecs=opus', ptt: true });
  }
});
