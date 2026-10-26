'use strict';
// .getfiledest <nomor|path> <tujuan>: kirim file bot ke owner / chat ini / grup / nomor lain (owner).
const fs = require('fs');
const path = require('path');
const { O } = require('../../lib/owner');
const { UsageError } = require('../../library/errors');
const { resolveFile, mimeOf } = require('../../lib/getfile');
const { toJid } = require('../../library/function');

const HELP = prefix => `乂 *Get File Tujuan*\n◦ ${prefix}getfiledest <nomor|path> owner\n◦ ${prefix}getfiledest <nomor|path> chat\n◦ ${prefix}getfiledest <nomor|path> grup <id grup>\n◦ ${prefix}getfiledest <nomor|path> dm <nomor>`;

module.exports = O({ id: 'owner.getfiledest', name: 'getfiledest', description: 'Kirim file source bot ke tujuan: owner / chat / grup <id> / dm <nomor>', usage: '<nomor|path> <tujuan>',
  async run(ctx) {
    const [which, dest = '', target = ''] = ctx.args;
    if (!which || !dest) return ctx.reply(HELP(ctx.prefix));
    const file = resolveFile(which);
    if (!file) throw new UsageError(`File "${which}" tidak ditemukan. Lihat ${ctx.prefix}getfile`);
    let jid;
    switch (dest.toLowerCase()) {
      case 'owner': jid = toJid(ctx.config.owner.number); break;
      case 'chat': jid = ctx.m.chat; break;
      case 'grup': case 'group': {
        if (!/^\d{10,30}@g\.us$/.test(target)) throw new UsageError(`ID grup tidak valid (contoh 120363000000000000@g.us).\n${HELP(ctx.prefix)}`);
        jid = target; break;
      }
      case 'dm': {
        const n = target.replace(/\D/g, '');
        if (!/^[1-9]\d{7,14}$/.test(n)) throw new UsageError(`Nomor tujuan tidak valid (diawali kode negara).\n${HELP(ctx.prefix)}`);
        jid = toJid(n); break;
      }
      default: throw new UsageError(HELP(ctx.prefix));
    }
    await ctx.yannajah.sendFile(jid, { buffer: fs.readFileSync(file.abs), mime: mimeOf(file.rel) }, { asDocument: true, fileName: path.basename(file.rel), caption: `乂 *Get File*\n◦ ${file.rel}` });
    await ctx.reply(`✓ ${file.rel} dikirim ke ${dest.toLowerCase()}${target ? ` ${target}` : ''}.`);
  } });
