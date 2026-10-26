'use strict';
// Kirim audio dari URL langsung (V15: .gtmp3). Anti-SSRF via sendFile (download publik).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

module.exports = feature({
  id: 'tools.gtmp3', name: 'gtmp3', category: 'tools', cooldown: 5, limit: 1,
  description: 'Kirim audio dari link mp3', usage: '<url mp3>',
  params: [{ name: 'url', required: true }],
  async run(ctx) {
    const url = (ctx.text || '').trim();
    if (!/^https?:\/\//i.test(url)) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} https://.../lagu.mp3`);
    await ctx.react('⏳');
    await ctx.sendFile(url, { mimetype: 'audio/mpeg' });
  }
});
