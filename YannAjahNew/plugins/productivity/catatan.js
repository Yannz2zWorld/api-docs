'use strict';
const { P, list } = require('../../lib/productivity');

module.exports = P({ id: 'productivity.note.list', name: 'catatan', aliases: ['notes', 'listnote'], description: 'Daftar catatan kamu',
  async run(ctx) { const n = list(ctx, 'notes'); await ctx.reply(n.length ? n.map((x, i) => `${i + 1}. ${x.text}`).join('\n') : 'Belum ada catatan. Tambah: .catat <teks>'); } });
