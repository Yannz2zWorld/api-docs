'use strict';
// Upload media ke Qu.ax (V15: .quax / .qu). Link permanen, bisa dibuka siapa saja.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { upload } = require('../../lib/uploader');

module.exports = feature({ id: 'tools.quax', name: 'quax', aliases: ['qu'], category: 'tools', description: 'Upload media ke Qu.ax (link permanen)', usage: '(kirim/reply media)', cooldown: 10, limit: 1,
  async run(ctx) {
    const md = ctx.media();
    if (!md) throw new UsageError(`Kirim/reply media dengan caption ${ctx.prefix}${ctx.command}`);
    await ctx.react('⏳');
    const buf = await md.download();
    const r = await upload(buf, md.mime, { hosts: ['quax', 'catbox'], logger: ctx.logger });
    await ctx.reply(`🔗 *Upload berhasil*\n${r.url}\n\n• Host: ${r.host}\n• Ukuran: ${(buf.length / 1024).toFixed(1)} KB\n⚠️ Link bisa dibuka siapa saja.`);
  } });
