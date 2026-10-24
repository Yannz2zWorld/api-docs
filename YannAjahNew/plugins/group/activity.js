'use strict';
// Aktivitas grup V15: pencatat chat (total chat, sider, auto level), streak harian berpasangan,
// ulang tahun member, absen harian otomatis (poll), jadwal pesan berulang.
const crypto = require('crypto');
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const scheduler = require('../../library/scheduler');
const { targetJid, mention, toPn } = require('../../library/targets');

const DAY = 86400000;
const G = f => feature({ category: 'group', scope: 'group', ...f });
const A = f => G({ permission: 'admin', ...f });
const act = g => { g.activity = g.activity || { since: Date.now(), users: {} }; return g.activity; };
const need = lvl => 100 * (lvl + 1) * (lvl + 1);
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const members = ctx => (ctx.m.groupMetadata?.participants || []).map(p => ({ jid: toPn(ctx, p.phoneNumber || p.id), admin: Boolean(p.admin) }));
const botJid = ctx => `${String(ctx.yannajah.socket?.user?.id || '').split(':')[0].split('@')[0]}@s.whatsapp.net`;
const dayStr = (ts, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(ts));

// ----------------------------------------------------------------- tugas berkala
scheduler.register('ultah', async (y, now) => {
  if (now.hour !== 7) return;
  for (const [jid, g] of Object.entries(y.database.raw().groups)) {
    const list = Object.entries(g.birthdays || {}).filter(([, b]) => b.day === now.day && b.month === now.month && b.sentYear !== now.year);
    for (const [user, b] of list) {
      b.sentYear = now.year; y.database.touch();
      const age = b.year ? ` yang ke-${now.year - b.year}` : '';
      await y.sendmessage(jid, { text: `🎂 Selamat ulang tahun${age} @${user.split('@')[0]}! 🎉\nSemoga panjang umur, sehat selalu, dan sukses! 🥳`, mentions: [user] }).catch(() => {});
    }
  }
});
scheduler.register('absen', async (y, now) => {
  for (const [jid, g] of Object.entries(y.database.raw().groups)) {
    const a = g.autoAbsen;
    if (!a?.enabled || a.time !== now.hhmm || a.lastSent === now.date) continue;
    a.lastSent = now.date; y.database.touch();
    await y.sendmessage(jid, { poll: { name: `📋 Absen ${now.day} ${MONTHS[now.month - 1]} ${now.year}`, values: ['✅ Hadir', '🤒 Sakit', '📝 Izin'], selectableCount: 1 } }).catch(() => {});
  }
});
scheduler.register('jadwalpesan', async y => {
  for (const [jid, g] of Object.entries(y.database.raw().groups)) {
    for (const j of g.scheduledMessages || []) {
      if (j.nextAt > Date.now()) continue;
      j.nextAt = Date.now() + j.everyMin * 60000; y.database.touch();
      await y.sendmessage(jid, { text: j.text }).catch(() => {});
    }
  }
});

// ----------------------------------------------------------------- streak
const pairKey = (a, b) => [a, b].sort().join('|');
function streakState(s, tz) {
  const today = dayStr(Date.now(), tz), yesterday = dayStr(Date.now() - DAY, tz);
  const alive = s.lastDay === today || s.lastDay === yesterday;
  return { today, yesterday, streak: alive ? s.streak : 0, litToday: s.lastDay === today };
}

module.exports = [
  // ----------------------------------------------------------------- pencatat & total chat
  A({ id: 'group.totalchat', name: 'totalchat', aliases: ['totalpesan'], permission: 'user', description: 'Peringkat jumlah chat member grup (sejak bot mencatat)',
    async run(ctx) {
      const a = act(ctx.group);
      const rows = Object.entries(a.users).sort((x, y) => y[1].count - x[1].count).slice(0, 30);
      if (!rows.length) return ctx.reply('📭 Belum ada chat yang tercatat.');
      const total = Object.values(a.users).reduce((s, u) => s + u.count, 0);
      await ctx.reply(`📊 *TOTAL CHAT GRUP*\nSejak: ${new Date(a.since).toLocaleDateString('id-ID', { timeZone: ctx.config.bot.timezone })}\nTotal: ${total.toLocaleString('id-ID')} pesan\n\n${rows.map(([j, u], i) => `${i + 1}. ${mention(j)} — ${u.count.toLocaleString('id-ID')}`).join('\n')}`);
    },
    // Hook: catat setiap pesan grup (+ exp & auto level). Tidak menghentikan pemrosesan.
    async onMessage(ctx) {
      const m = ctx.m;
      if (!m.isGroup || m.fromMe) return false;
      const g = ctx.db.group(m.chat); const a = act(g);
      const u = a.users[m.sender] = a.users[m.sender] || { count: 0, last: 0 };
      u.count++; u.last = Date.now();
      const user = ctx.db.user(m.sender);
      if (!user.lastXp || Date.now() - user.lastXp > 60000) {
        user.lastXp = Date.now(); user.exp = (user.exp || 0) + crypto.randomInt(5, 16);
        let up = false;
        while (user.exp >= need(user.level || 0)) { user.level = (user.level || 0) + 1; up = true; }
        if (up && g.autolevel) {
          const tpl = g.autolevelText || '🎉 Selamat @user naik ke level *@level*! (XP: @xp)';
          await ctx.yannajah.sendmessage(m.chat, { text: tpl.replace(/@user/g, mention(m.sender)).replace(/@level/g, user.level).replace(/@xp/g, user.exp), mentions: [m.sender] }).catch(() => {});
        }
      }
      ctx.db.touch();
      scheduler.start(ctx.yannajah, ctx.config);
      return false;
    } }),
  A({ id: 'group.resettotalchat', name: 'resettotalchat', description: 'Reset hitungan chat grup',
    async run(ctx) { ctx.group.activity = { since: Date.now(), users: {} }; ctx.db.touch(); await ctx.reply('✅ Total chat grup direset.'); } }),
  A({ id: 'group.sider', name: 'sider', aliases: ['ceksider', 'gcsider', 'groupsider', 'sidercek', 'sidergc', 'sidergroup'], description: 'Daftar member pasif (tidak chat N hari, default 7)', usage: '[hari]',
    async run(ctx) {
      const days = Math.min(Math.max(Number(ctx.args[0]) || 7, 1), 365);
      const a = act(ctx.group); const cut = Date.now() - days * DAY; const bot = botJid(ctx);
      const tracked = Math.floor((Date.now() - a.since) / DAY);
      const list = members(ctx).filter(p => !p.admin && p.jid !== bot && !((a.users[p.jid]?.last || 0) > cut));
      await ctx.reply(`👻 *SIDER GRUP* (tidak chat ${days} hari)\nBot mencatat sejak ${tracked} hari lalu${tracked < days ? ' — data belum lengkap' : ''}\nTotal: ${list.length} dari ${members(ctx).length} member\n\n${list.slice(0, 100).map((p, i) => `${i + 1}. ${mention(p.jid)}${a.users[p.jid] ? ` (terakhir ${Math.floor((Date.now() - a.users[p.jid].last) / DAY)} hari)` : ' (belum pernah chat)'}`).join('\n')}${list.length ? `\n\nKick: ${ctx.prefix}kicksider ${days} confirm` : ''}`);
    } }),
  A({ id: 'group.kicksider', name: 'kicksider', aliases: ['siderkick'], botAdmin: true, cooldown: 30, description: 'Keluarkan member pasif: .kicksider <hari> confirm (maks 50 sekali jalan)', usage: '<hari> confirm',
    async run(ctx) {
      const days = Math.min(Math.max(Number(ctx.args[0]) || 7, 1), 365);
      const a = act(ctx.group); const cut = Date.now() - days * DAY; const bot = botJid(ctx);
      if (Date.now() - a.since < days * DAY) throw new UsageError(`❌ Bot baru mencatat ${Math.floor((Date.now() - a.since) / DAY)} hari. Tunggu sampai ${days} hari agar tidak salah kick.`);
      const list = members(ctx).filter(p => !p.admin && p.jid !== bot && !((a.users[p.jid]?.last || 0) > cut)).map(p => p.jid).slice(0, 50);
      if (!list.length) return ctx.reply('✅ Tidak ada sider.');
      if (!ctx.args.includes('confirm')) throw new UsageError(`⚠️ ${list.length} member akan dikeluarkan. Lanjut: ${ctx.prefix}kicksider ${days} confirm`);
      for (let i = 0; i < list.length; i += 5) await ctx.yannajah.socket.groupParticipantsUpdate(ctx.m.chat, list.slice(i, i + 5), 'remove');
      await ctx.reply(`✅ ${list.length} sider dikeluarkan.`);
    } }),
  A({ id: 'group.autolevel', name: 'autolevel', aliases: ['autolv'], description: 'Umumkan member naik level: on/off/set <pesan> (@user @level @xp)', usage: 'on/off/set <pesan>',
    async run(ctx) {
      const a = (ctx.args[0] || '').toLowerCase();
      if (a === 'set') { ctx.group.autolevelText = ctx.args.slice(1).join(' ').slice(0, 500) || null; ctx.db.touch(); return ctx.reply('✅ Pesan naik level disimpan.'); }
      if (!['on', 'off'].includes(a)) return ctx.reply(`╭一緒 *Auto Level*\n│୭ ˚.ᵎᵎ Status : ${ctx.group.autolevel ? '✅ AKTIF' : '❌ NONAKTIF'}\n│୭ ˚.ᵎᵎ ${ctx.prefix}autolevel on/off\n│୭ ˚.ᵎᵎ ${ctx.prefix}autolevel set <pesan>\n│୭ ˚.ᵎᵎ Variabel: @user @level @xp\n╰─────────一緒`);
      ctx.group.autolevel = a === 'on'; ctx.db.touch(); await ctx.reply(`✅ Auto level ${a === 'on' ? 'diaktifkan' : 'dimatikan'}.`);
    } }),

  // ----------------------------------------------------------------- streak
  G({ id: 'group.buatstreak', name: 'buatstreak', description: 'Mulai streak harian dengan teman: .buatstreak @user', usage: '@user',
    async run(ctx) {
      const t = targetJid(ctx); if (t === ctx.m.sender) throw new UsageError('❌ Kamu tidak bisa buat streak dengan diri sendiri!');
      const all = ctx.group.streaks = ctx.group.streaks || {}; const k = pairKey(ctx.m.sender, t);
      if (all[k] && streakState(all[k], ctx.config.bot.timezone).streak > 0) throw new UsageError(`❌ Streak dengan ${mention(t)} sudah aktif (🔥 ${all[k].streak}).`);
      all[k] = { a: ctx.m.sender, b: t, streak: 0, lastDay: null, lit: {}, best: all[k]?.best || 0, createdAt: Date.now() }; ctx.db.touch();
      await ctx.reply(`🔥 Streak ${mention(ctx.m.sender)} & ${mention(t)} dimulai!\nKalian berdua ketik *${ctx.prefix}nyalainstreak* setiap hari agar streak bertambah.`);
    } }),
  G({ id: 'group.nyalainstreak', name: 'nyalainstreak', aliases: ['nyalakanstreak'], description: 'Nyalakan streak hari ini (dua orang harus menyalakan)',
    async run(ctx) {
      const tz = ctx.config.bot.timezone; const all = ctx.group.streaks || {};
      const mine = Object.values(all).filter(s => s.a === ctx.m.sender || s.b === ctx.m.sender);
      if (!mine.length) throw new UsageError(`❌ Kamu belum punya streak. Mulai: ${ctx.prefix}buatstreak @teman`);
      const out = [];
      for (const s of mine) {
        const st = streakState(s, tz); const other = s.a === ctx.m.sender ? s.b : s.a;
        s.lit = s.lit || {}; s.lit[ctx.m.sender] = st.today;
        if (st.litToday) { out.push(`✅ Streak dengan ${mention(other)} sudah menyala hari ini (🔥 ${s.streak})`); continue; }
        if (s.lit[other] === st.today) { s.streak = st.streak + 1; s.lastDay = st.today; s.best = Math.max(s.best || 0, s.streak); out.push(`🔥 Streak dengan ${mention(other)} naik jadi *${s.streak} hari*!`); }
        else out.push(`⏳ Menunggu ${mention(other)} menyalakan streak hari ini.`);
      }
      ctx.db.touch(); await ctx.reply(out.join('\n'));
    } }),
  G({ id: 'group.cekstreak', name: 'cekstreak', aliases: ['streak'], description: 'Cek streak kamu (atau dengan @user)', usage: '[@user]',
    async run(ctx) {
      const tz = ctx.config.bot.timezone; const all = ctx.group.streaks || {};
      const other = (ctx.m.mentionedJid?.length || ctx.m.quoted) ? targetJid(ctx) : null;
      const list = Object.values(all).filter(s => (s.a === ctx.m.sender || s.b === ctx.m.sender) && (!other || s.a === other || s.b === other));
      if (!list.length) throw new UsageError('❌ Belum ada streak.');
      await ctx.reply(list.map(s => { const st = streakState(s, tz); const o = s.a === ctx.m.sender ? s.b : s.a; return `🔥 ${mention(o)}: *${st.streak} hari* ${st.litToday ? '(sudah menyala hari ini)' : st.streak ? '(belum menyala hari ini!)' : '(padam)'} — rekor ${s.best || 0}`; }).join('\n'));
    } }),
  G({ id: 'group.topstreak', name: 'topstreak', description: 'Top 5 streak di grup',
    async run(ctx) {
      const tz = ctx.config.bot.timezone;
      const list = Object.values(ctx.group.streaks || {}).map(s => ({ s, n: streakState(s, tz).streak })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 5);
      if (!list.length) throw new UsageError('❌ Belum ada streak yang berhasil dipertahankan di grup ini.');
      await ctx.reply(`🏆 *TOP 5 DAILY STREAK*\n\n${list.map((x, i) => `${i + 1}. ${mention(x.s.a)} & ${mention(x.s.b)} — 🔥 ${x.n} hari`).join('\n')}`);
    } }),

  // ----------------------------------------------------------------- ulang tahun
  G({ id: 'group.setultah', name: 'setultah', description: 'Simpan tanggal ulang tahunmu: .setultah DD/MM atau DD/MM/YYYY (bot mengucapkan jam 07:00)', usage: 'DD/MM[/YYYY]',
    async run(ctx) {
      const mm = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/.exec(ctx.args[0] || '');
      if (!mm) throw new UsageError(`Format: ${ctx.prefix}setultah 25/12 atau 25/12/2005`);
      const [day, month, year] = [Number(mm[1]), Number(mm[2]), mm[3] ? Number(mm[3]) : null];
      const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
      if (!max || day < 1 || day > max || (year && (year < 1900 || year > new Date().getFullYear()))) throw new UsageError('❌ Tanggal tidak valid.');
      const b = ctx.group.birthdays = ctx.group.birthdays || {}; b[ctx.m.sender] = { day, month, year }; ctx.db.touch();
      scheduler.start(ctx.yannajah, ctx.config);
      await ctx.reply(`🎂 Ulang tahunmu disimpan: ${day} ${MONTHS[month - 1]}${year ? ` ${year}` : ''}`);
    } }),
  G({ id: 'group.cekultah', name: 'cekultah', aliases: ['ultah'], description: 'Hitung mundur ulang tahun (kamu atau @user)', usage: '[@user]',
    async run(ctx) {
      const t = targetJid(ctx, { self: true }); const b = ctx.group.birthdays?.[t];
      if (!b) throw new UsageError(`❌ ${t === ctx.m.sender ? `Kamu belum mendaftarkan ulang tahun. ${ctx.prefix}setultah DD/MM` : 'User belum mendaftarkan ulang tahun.'}`);
      const now = scheduler.localNow(ctx.config.bot.timezone);
      const today = Date.UTC(now.year, now.month - 1, now.day);
      let next = Date.UTC(now.year, b.month - 1, b.day); if (next < today) next = Date.UTC(now.year + 1, b.month - 1, b.day);
      const d = Math.round((next - today) / DAY);
      await ctx.reply(d === 0 ? `🎂 ${mention(t)} hari ini ulang tahun${b.year ? ` yang ke-${now.year - b.year}` : ''}! 🎉` : `🎂 Ulang tahun ${mention(t)}: ${b.day} ${MONTHS[b.month - 1]}\n⏳ ${d} hari lagi`);
    } }),
  G({ id: 'group.listultah', name: 'listultah', description: 'Daftar ulang tahun member grup',
    async run(ctx) { const l = Object.entries(ctx.group.birthdays || {}).sort((a, b) => a[1].month - b[1].month || a[1].day - b[1].day); await ctx.reply(l.length ? `🎂 *ULANG TAHUN MEMBER*\n\n${l.map(([j, b]) => `• ${b.day} ${MONTHS[b.month - 1]} — ${mention(j)}`).join('\n')}` : '📭 Belum ada yang mendaftarkan ulang tahun.'); } }),
  G({ id: 'group.delultah', name: 'delultah', description: 'Hapus tanggal ulang tahunmu (admin: @user)', usage: '[@user]',
    async run(ctx) { const t = ctx.isAdmin || ctx.isOwner ? targetJid(ctx, { self: true }) : ctx.m.sender; if (!ctx.group.birthdays?.[t]) throw new UsageError('❌ Tidak ada data.'); delete ctx.group.birthdays[t]; ctx.db.touch(); await ctx.reply('✅ Data ulang tahun dihapus.'); } }),
  A({ id: 'group.testultah', name: 'testultah', description: 'Tes pesan ucapan ulang tahun',
    async run(ctx) { await ctx.reply(`🎂 Selamat ulang tahun ${mention(ctx.m.sender)}! 🎉\nSemoga panjang umur, sehat selalu, dan sukses! 🥳`); } }),

  // ----------------------------------------------------------------- absen harian
  A({ id: 'group.autoabsen', name: 'autoabsen', description: 'Kirim poll absen otomatis setiap hari (jam default 07:00)', usage: 'on/off',
    async run(ctx) {
      const v = (ctx.args[0] || '').toLowerCase(); const a = ctx.group.autoAbsen = ctx.group.autoAbsen || { enabled: false, time: '07:00', lastSent: '' };
      if (!['on', 'off'].includes(v)) return ctx.reply(`📋 Auto absen: *${a.enabled ? `ON jam ${a.time}` : 'OFF'}*\n${ctx.prefix}autoabsen on/off\n${ctx.prefix}setabsen HH:MM`);
      a.enabled = v === 'on'; ctx.db.touch(); scheduler.start(ctx.yannajah, ctx.config);
      await ctx.reply(a.enabled ? `✅ Auto absen aktif. Poll dikirim setiap hari jam ${a.time} (${ctx.config.bot.timezone}).` : '✅ Auto absen dimatikan.');
    } }),
  A({ id: 'group.setabsen', name: 'setabsen', description: 'Atur jam auto absen (HH:MM, 24 jam)', usage: 'HH:MM',
    async run(ctx) {
      const t = ctx.args[0] || ''; if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(t)) throw new UsageError('❌ Format waktu salah! Gunakan HH:MM (contoh 07:00)');
      const hhmm = t.padStart(5, '0');
      ctx.group.autoAbsen = { ...(ctx.group.autoAbsen || {}), enabled: true, time: hhmm, lastSent: '' }; ctx.db.touch(); scheduler.start(ctx.yannajah, ctx.config);
      await ctx.reply(`✅ Waktu absen diatur ke: ${hhmm}\n📌 Bot kirim poll absen setiap hari jam ${hhmm}`);
    } }),

  // ----------------------------------------------------------------- jadwal pesan berulang
  A({ id: 'group.jadwalpesan', name: 'jadwalpesan', aliases: ['jadpes', 'schedmsg'], description: 'Kirim pesan berulang tiap N menit: .jadwalpesan 60 | Jangan lupa absen!', usage: '<menit> | <pesan>',
    async run(ctx) {
      const [a, ...rest] = ctx.requireText().split('|'); const every = Number(a); const text = rest.join('|').trim();
      if (!(every >= 5 && every <= 10080) || !text) throw new UsageError('Format: .jadwalpesan <menit 5-10080> | <pesan>');
      const l = ctx.group.scheduledMessages = ctx.group.scheduledMessages || [];
      if (l.length >= 5) throw new UsageError('Maksimal 5 jadwal pesan per grup.');
      l.push({ everyMin: every, text: text.slice(0, 2000), nextAt: Date.now() + every * 60000, by: ctx.m.sender }); ctx.db.touch(); scheduler.start(ctx.yannajah, ctx.config);
      await ctx.reply(`✅ Pesan dijadwalkan setiap ${every} menit (#${l.length}).`);
    } }),
  A({ id: 'group.stopjadwalpesan', name: 'stopjadwalpesan', aliases: ['sjp', 'stopjadpes', 'stopschedmsg'], description: 'Hentikan jadwal pesan (nomor, default terakhir)', usage: '[nomor]',
    async run(ctx) { const l = ctx.group.scheduledMessages || []; if (!l.length) throw new UsageError('❌ Tidak ada jadwal pesan aktif.'); const i = ctx.args[0] ? Number(ctx.args[0]) - 1 : l.length - 1; if (!l[i]) throw new UsageError('Nomor tidak ada.'); l.splice(i, 1); ctx.db.touch(); await ctx.reply('✅ Jadwal pesan dihentikan.'); } }),
  A({ id: 'group.stopalljadwalpesan', name: 'stopallschedmsg', aliases: ['sjps', 'stopjadwalpesanall', 'stopjadwalpesansemua'], description: 'Hentikan semua jadwal pesan grup',
    async run(ctx) { const n = (ctx.group.scheduledMessages || []).length; ctx.group.scheduledMessages = []; ctx.db.touch(); await ctx.reply(`✅ ${n} jadwal pesan dihentikan.`); } }),
  G({ id: 'group.listjadwalpesan', name: 'cekjadwalpesan', aliases: ['listschedmsg'], description: 'Daftar jadwal pesan grup',
    async run(ctx) { const l = ctx.group.scheduledMessages || []; await ctx.reply(l.length ? l.map((j, i) => `${i + 1}. tiap ${j.everyMin} menit — berikutnya ${Math.max(0, Math.round((j.nextAt - Date.now()) / 60000))} menit lagi\n   ${j.text.slice(0, 60)}`).join('\n') : '📭 Tidak ada jadwal pesan.'); } })
];
