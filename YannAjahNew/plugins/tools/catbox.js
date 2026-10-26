'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { upload } = require('../../lib/uploader');

module.exports = feature({ id: 'tools.catbox', name: 'catbox', aliases: [], category: 'tools', description: 'Upload media ke Catbox (link permanen)', usage: '(kirim/reply media)', cooldown: 10, limit: 1,
  async run(ctx) {
    const md = ctx.media();
    if (!md) throw new UsageError(`Kirim atau reply gambar/video/audio/dokumen dengan caption ${ctx.prefix}${ctx.command}`);
    await ctx.react('⏳');
    const buf = await md.download();
    const r = await upload(buf, md.mime, { hosts: ['catbox'], logger: ctx.logger });
    await ctx.reply(`🔗 *Upload berhasil*\n${r.url}\n\n• Host: ${r.host}\n• Ukuran: ${(buf.length / 1024).toFixed(1)} KB\n⚠️ Link bisa dibuka siapa saja.`);
  } });
