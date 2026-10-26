'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { upload } = require('../../lib/uploader');

module.exports = feature({ id: 'tools.tourl', name: 'tourl', aliases: ['touploader', 'tourl2', 'tourl3'], category: 'tools', description: 'Upload media jadi link (Catbox, cadangan Uguu)', usage: '(kirim/reply media)', cooldown: 10, limit: 1,
  async run(ctx) {
    const md = ctx.media();
    if (!md) throw new UsageError(`Kirim atau reply gambar/video/audio/dokumen dengan caption ${ctx.prefix}${ctx.command}`);
    await ctx.react('⏳');
    const buf = await md.download();
    const r = await upload(buf, md.mime, { hosts: ['catbox','uguu'], logger: ctx.logger });
    await ctx.reply(`🔗 *Upload berhasil*\n${r.url}\n\n• Host: ${r.host}\n• Ukuran: ${(buf.length / 1024).toFixed(1)} KB\n⚠️ Link bisa dibuka siapa saja.`);
  } });
