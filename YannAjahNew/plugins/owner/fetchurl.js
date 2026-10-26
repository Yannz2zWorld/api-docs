'use strict';
// Ambil isi URL dan kirim ke chat (V15: .get / .g / .fetch). OWNER ONLY. Anti-SSRF via library/net (publicOnly).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { request } = require('../../library/net');
const { sniffMime } = require('../../library/function');

module.exports = feature({
  id: 'owner.fetchurl', name: 'get', aliases: ['g', 'fetch'], category: 'owner', permission: 'owner', cooldown: 5,
  description: 'Ambil isi URL (gambar/video/audio/teks) dan kirim ke chat', usage: '<url>',
  async run(ctx) {
    let url = (ctx.text || '').trim();
    if (!url) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} https://example.com/file.jpg`);
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    await ctx.react('⏳');
    const r = await request(url, { publicOnly: true, maxBytes: ctx.config.media.maxDownloadBytes, timeoutMs: 60000 });
    if (r.status >= 400) throw new UsageError(`Gagal mengambil (HTTP ${r.status}).`);
    const ct = String(r.headers['content-type'] || '').toLowerCase();
    const sniff = sniffMime(r.body);
    const mime = sniff?.mime || ct.split(';')[0] || 'application/octet-stream';
    if (/^(image|video|audio)\//.test(mime)) {
      await ctx.yannajah.sendFile(ctx.m.chat, { buffer: r.body, mime }, { caption: `✅ ${(r.body.length / 1024).toFixed(1)} KB · ${mime}`, quoted: ctx.m.raw });
    } else {
      let text = r.body.toString('utf8');
      try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* biarkan apa adanya */ }
      if (text.length > 60000) await ctx.yannajah.sendFile(ctx.m.chat, { buffer: Buffer.from(text), mime: 'text/plain' }, { asDocument: true, fileName: 'get.txt', quoted: ctx.m.raw });
      else await ctx.reply(text || '(kosong)');
    }
  }
});
