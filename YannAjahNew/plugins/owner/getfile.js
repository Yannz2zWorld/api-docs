'use strict';
// .getfile [nomor|path|kata kunci]: daftar file bot atau kirim satu file sebagai dokumen (owner).
const fs = require('fs');
const path = require('path');
const { O } = require('../../lib/owner');
const { resolveFile, renderList, mimeOf } = require('../../lib/getfile');

module.exports = O({ id: 'owner.getfile', name: 'getfile', description: 'Ambil file source bot: .getfile (daftar), .getfile <nomor|path>, .getfile <kata kunci>', usage: '[nomor|path|kata kunci]',
  async run(ctx) {
    const arg = ctx.text.trim();
    const file = arg ? resolveFile(arg) : null;
    if (file) return ctx.sendFile({ buffer: fs.readFileSync(file.abs), mime: mimeOf(file.rel) }, { asDocument: true, fileName: path.basename(file.rel), caption: `乂 *Get File*\n◦ ${file.rel}` });
    const list = renderList(/^\d+$/.test(arg) ? '' : arg);
    if (!list) return ctx.reply(`File "${arg}" tidak ditemukan. Ketik ${ctx.prefix}getfile untuk daftar.`);
    await ctx.reply(`乂 *Daftar File*${arg && !/^\d+$/.test(arg) ? ` : ${arg}` : ''}\n\n${list}\n\nAmbil: ${ctx.prefix}getfile <nomor>  ·  Kirim ke tujuan lain: ${ctx.prefix}getfiledest`);
  } });
