'use strict';
// Bersihkan file sesi sinyal lama (pre-key/sender-key/session-*) di folder session WhatsApp.
// creds.json TIDAK dihapus, jadi bot tetap tertaut (tidak perlu pairing ulang).
const fs = require('fs');
const path = require('path');
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.clearsesi', name: 'clearsesi', aliases: ['clearsession', 'clsesi'], description: 'Hapus file sesi sementara WhatsApp (creds.json tetap aman)',
  async run(ctx) {
    const dir = ctx.yannajah.wa?.sessionDir || path.resolve(__dirname, '..', '..', ctx.config.pairing.sessionDir);
    if (!fs.existsSync(dir)) return ctx.reply('Folder session tidak ada.');
    let n = 0, bytes = 0;
    for (const f of fs.readdirSync(dir)) {
      if (f === 'creds.json' || !/^(pre-key|sender-key|session|app-state-sync-version|sender-key-memory)-/.test(f)) continue;
      const p = path.join(dir, f);
      try { bytes += fs.statSync(p).size; fs.unlinkSync(p); n++; } catch { /* dipakai, lewati */ }
    }
    await ctx.reply(`✅ ${n} file sesi dibersihkan (${(bytes / 1024).toFixed(1)} KB). creds.json tetap ada. Kalau ada error dekripsi, restart bot.`);
  } });
