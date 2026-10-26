'use strict';
const { O, obj } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.listrespon', name: 'listrespon', description: 'Daftar respon otomatis',
  async run(ctx) { const r = Object.entries(obj(ctx.db.raw(), 'responses')); const icon = v => ({ image: '🖼️', video: '🎥', audio: '🎵', sticker: '🏷️', document: '📄' }[v.media?.kind] || '💬'); await ctx.reply(r.length ? `*📋 LIST RESPON*\n\n${r.map(([k, v]) => `${icon(v)} *${k}*`).join('\n')}` : 'Tidak ada respon.'); } });
