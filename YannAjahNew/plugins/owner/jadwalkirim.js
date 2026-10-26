'use strict';
const { UsageError } = require('../../library/errors');
const { normalizePhone, toJid, jidUser } = require('../../library/function');
const scheduler = require('../../library/scheduler');
const { O } = require('../../lib/owner');
const { MAX_PENDING, parseWhen, list } = require('../../lib/schedulesend');

const fmt = (ts, tz) => new Intl.DateTimeFormat('id-ID', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));

module.exports = O({ id: 'owner.jadwalkirim', name: 'jadwalkirim', aliases: ['jadwalngirimpesan', 'schedulesend'], description: 'Jadwalkan pesan sekali kirim ke nomor/grup: .jadwalkirim 628xxx 10m Halo! (waktu: 30s/10m/2h/1d atau 21:30) · .jadwalkirim list · .jadwalkirim hapus <n>',
  usage: '<nomor|here> <waktu> <pesan> | list | hapus <n>',
  async run(ctx) {
    const tz = ctx.config.bot.timezone;
    const l = list(ctx.db);
    const [a, b, ...rest] = ctx.args;
    if (!a || a === 'list') {
      if (!l.length) return ctx.reply(`Belum ada jadwal kirim.\n${ctx.usage()}`);
      return ctx.reply(`🗓️ *Jadwal kirim* (${l.length})\n${l.map((j, i) => `${i + 1}. ${fmt(j.at, tz)} → ${j.to.endsWith('@g.us') ? 'grup' : jidUser(j.to)}: ${j.text.slice(0, 50)}`).join('\n')}`);
    }
    if (a === 'hapus' || a === 'del') {
      const i = Number(b) - 1;
      if (!(i >= 0 && i < l.length)) throw new UsageError('Nomor jadwal tidak ada. Lihat: .jadwalkirim list');
      l.splice(i, 1); ctx.db.touch();
      return ctx.reply('✅ Jadwal dihapus.');
    }
    const to = a === 'here' || a === 'sini' ? ctx.m.chat : (normalizePhone(a) ? toJid(normalizePhone(a)) : null);
    const at = parseWhen(b, tz);
    const text = rest.join(' ').trim() || ctx.m.quoted?.text || '';
    if (!to || !at || !text) throw new UsageError(`Format salah.\n${ctx.usage()}\nContoh: .jadwalkirim 6281234567890 10m Dana kaget!`);
    if (at - Date.now() > 30 * 86400000) throw new UsageError('Maksimal 30 hari ke depan.');
    if (l.length >= MAX_PENDING) throw new UsageError(`Maksimal ${MAX_PENDING} jadwal kirim.`);
    l.push({ to, at, text: text.slice(0, 4000), by: ctx.m.sender }); ctx.db.touch();
    scheduler.start(ctx.yannajah, ctx.config);
    await ctx.reply(`✅ Pesan dijadwalkan ${fmt(at, tz)} ke ${to.endsWith('@g.us') ? 'grup ini' : jidUser(to)}.`);
  } });
