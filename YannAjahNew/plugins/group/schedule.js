'use strict';
const { UsageError } = require('../../library/errors');
const scheduler = require('../../library/scheduler');
const media = require('../../library/mediastore');
const { A } = require('../../lib/group-admin');

module.exports = A({ id: 'group.schedule', name: 'schedule', description: 'Posting bulanan otomatis + hidetag: .schedule <pesan>|<tanggal 1-31> (boleh kirim/reply media), list, delete <no>, clear', usage: '<pesan>|<tanggal>',
  async run(ctx) {
    const l = ctx.group.monthlyPosts = ctx.group.monthlyPosts || [];
    const cmd = (ctx.args[0] || '').toLowerCase();
    if (!ctx.text.includes('|')) {
      if (['list', 'daftar'].includes(cmd)) return ctx.reply(l.length ? `📅 *Jadwal Posting Bulanan*\n\n${l.map((p, i) => `${i + 1}. Tanggal ${p.day} — ${p.media ? p.media.kind : 'teks'}\n   ${p.text.slice(0, 50)}`).join('\n')}` : '📭 Tidak ada jadwal posting.');
      if (['clear', 'bersihkan'].includes(cmd)) { const n = l.map(p => p.media?.name); ctx.group.monthlyPosts = []; ctx.db.touch(); n.forEach(x => media.release(x, ctx.db)); return ctx.reply('✅ Semua jadwal posting dihapus.'); }
      if (['delete', 'hapus'].includes(cmd)) { const i = Number(ctx.args[1]) - 1; if (!l[i]) throw new UsageError('❌ Nomor tidak valid!'); const [p] = l.splice(i, 1); ctx.db.touch(); media.release(p.media?.name, ctx.db); return ctx.reply(`✅ Jadwal #${i + 1} dihapus.`); }
      return ctx.reply(`📅 *JADWAL POSTING* (otomatis hidetag)\n• ${ctx.prefix}schedule <pesan>|<tanggal>\n• ${ctx.prefix}schedule list\n• ${ctx.prefix}schedule delete <no>\n• ${ctx.prefix}schedule clear\nContoh: ${ctx.prefix}schedule Reset bulanan|1`);
    }
    const [a, b] = ctx.text.split('|').map(x => x.trim());
    const day = /^\d{1,2}$/.test(b) ? Number(b) : /^\d{1,2}$/.test(a) ? Number(a) : 0; const text = /^\d{1,2}$/.test(b) ? a : b;
    if (!(day >= 1 && day <= 31) || !text) throw new UsageError('❌ Tanggal harus 1-31 dan pesan tidak boleh kosong.');
    if (l.length >= 10) throw new UsageError('Maksimal 10 jadwal posting per grup.');
    l.push({ day, text: text.slice(0, 3000), media: await media.fromMessage(ctx, { kinds: ['image', 'video'] }), by: ctx.m.sender }); ctx.db.touch(); scheduler.start(ctx.yannajah, ctx.config);
    await ctx.reply(`✅ Posting dijadwalkan setiap tanggal ${day} jam 00:00.`);
  } });
