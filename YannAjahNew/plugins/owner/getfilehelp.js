'use strict';
// .getfilehelp: cara pakai .getfile & .getfiledest (owner).
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.getfilehelp', name: 'getfilehelp', description: 'Cara pakai .getfile dan .getfiledest',
  async run(ctx) {
    const p = ctx.prefix;
    await ctx.reply([
      '乂 *Get File*',
      `◦ ${p}getfile — daftar semua file bot`,
      `◦ ${p}getfile plugins/owner — daftar file yang path-nya mengandung kata itu`,
      `◦ ${p}getfile 12 / ${p}getfile settingsbot.js — kirim file sebagai dokumen`,
      `◦ ${p}getfiledest 12 owner|chat — kirim ke owner / chat ini`,
      `◦ ${p}getfiledest 12 grup <id grup> — kirim ke grup`,
      `◦ ${p}getfiledest 12 dm <nomor> — kirim ke nomor`,
      '',
      'Tidak pernah ikut: .env, session WhatsApp, database lokal, log.'
    ].join('\n'));
  } });
