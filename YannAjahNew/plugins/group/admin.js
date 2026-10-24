'use strict';
// Tools admin grup V15: buka/tutup grup berwaktu & terjadwal harian, posting bulanan, mute grup
// (owner), mode hanya-grup, anti bot lain, poll hidetag, buat grup, foto grup, ID grup,
// permintaan bergabung, tes welcome/left, label member bot, info & reset warn.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const scheduler = require('../../library/scheduler');
const media = require('../../library/mediastore');
const { targetJid, mention } = require('../../library/targets');
const { render, DEFAULT_WELCOME, DEFAULT_LEFT } = require('../../myfunct/handler');

const G = f => feature({ category: 'group', scope: 'group', ...f });
const A = f => G({ permission: 'admin', ...f });
const O = f => feature({ category: 'owner', permission: 'owner', allowInMaintenance: true, ...f });
const sock = ctx => { const s = ctx.yannajah.socket; if (!s) throw new UsageError('Bot belum terhubung.'); return s; };
const UNITS = { detik: 1000, menit: 60000, jam: 3600000, hari: 86400000 };
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const BOT_ID = /^(BAE5|3EB0|B1E|BAE)[A-F0-9]{8,}$/;

// ----------------------------------------------------------------- tugas berkala grup
scheduler.register('grup-buka-tutup', async (y, now) => {
  for (const [jid, g] of Object.entries(y.database.raw().groups)) {
    // berwaktu (.opentime/.closetime)
    if (g.timedSetting && g.timedSetting.at <= Date.now()) {
      const t = g.timedSetting; delete g.timedSetting; y.database.touch();
      await y.socket.groupSettingUpdate(jid, t.action === 'close' ? 'announcement' : 'not_announcement')
        .then(() => y.sendmessage(jid, { text: t.action === 'close' ? (g.closeMessage || '🔒 *TEPAT WAKTU*\nGrup ditutup oleh sistem. Sekarang hanya admin yang dapat mengirim pesan.') : (g.openMessage || '🔓 *TEPAT WAKTU*\nGrup dibuka oleh sistem. Semua member bisa mengirim pesan.') }))
        .catch(() => y.sendmessage(jid, { text: '❌ Gagal mengubah setelan grup. Pastikan bot masih admin.' }).catch(() => {}));
    }
    // harian (.setopentime/.setclosetime)
    const d = g.dailySchedule;
    if (!d) continue;
    for (const [kind, setting] of [['close', 'announcement'], ['open', 'not_announcement']]) {
      if (d[`${kind}Time`] !== now.hhmm || d[`last_${kind}`] === now.date) continue;
      d[`last_${kind}`] = now.date; y.database.touch();
      await y.socket.groupSettingUpdate(jid, setting).then(() => y.sendmessage(jid, { text: d[`${kind}Message`] || (kind === 'close' ? `🔒 Grup ditutup otomatis (${now.hhmm}).` : `🔓 Grup dibuka otomatis (${now.hhmm}).`) })).catch(() => {});
    }
  }
});
scheduler.register('posting-bulanan', async (y, now) => {
  if (now.hhmm !== '00:00' && now.hour !== 0) return;
  for (const [jid, g] of Object.entries(y.database.raw().groups)) {
    for (const p of g.monthlyPosts || []) {
      if (p.day !== now.day || p.lastSent === now.date) continue;
      p.lastSent = now.date; y.database.touch();
      const meta = await y.socket.groupMetadata(jid).catch(() => null);
      const mentions = (meta?.participants || []).map(x => x.id);
      const c = p.media ? media.content(p.media, p.text) : { text: p.text };
      await y.sendmessage(jid, { ...(c || { text: p.text }), mentions }).catch(() => {});
    }
  }
});

function parseDuration(args) {
  const n = Number(args[0]); const u = UNITS[String(args[1] || '').toLowerCase()];
  if (!(n > 0) || !u) return null;
  const ms = n * u;
  return ms >= 10000 && ms <= 30 * 86400000 ? ms : null;
}
const timed = (action, word) => A({
  id: `group.${action}time`, name: `${action}time`, botAdmin: true, usage: '<angka> <detik/menit/jam/hari>',
  description: `${word} grup otomatis setelah waktu tertentu: .${action}time 10 menit`,
  async run(ctx) {
    const ms = parseDuration(ctx.args); if (!ms) throw new UsageError(`Format: ${ctx.prefix}${action}time <waktu> <detik/menit/jam/hari>\nContoh: ${ctx.prefix}${action}time 10 menit (10 detik - 30 hari)`);
    ctx.group.timedSetting = { action, at: Date.now() + ms, by: ctx.m.sender }; ctx.db.touch(); scheduler.start(ctx.yannajah, ctx.config);
    await ctx.reply(`⏰ *${action === 'open' ? 'Open' : 'Close'} Time ${ctx.args[0]} ${ctx.args[1]}* dimulai dari sekarang.\nGrup akan ${word.toLowerCase()} otomatis setelah waktu habis.`);
  }
});
const daily = (kind, word) => A({
  id: `group.set${kind}time`, name: `set${kind}time`, botAdmin: true, usage: 'HH:MM[|pesan]',
  description: `${word} grup otomatis setiap hari jam tertentu: .set${kind}time 22:00|Grup tutup, selamat malam`,
  async run(ctx) {
    const [t, msg] = ctx.requireText(`Contoh: ${ctx.prefix}set${kind}time ${kind === 'close' ? '22:00' : '05:00'}`).split('|');
    const hhmm = t.trim().padStart(5, '0'); if (!HHMM.test(hhmm)) throw new UsageError('❌ Format jam salah! Gunakan HH:MM (contoh: 05:00)');
    const d = ctx.group.dailySchedule = ctx.group.dailySchedule || {};
    d[`${kind}Time`] = hhmm; if (msg?.trim()) d[`${kind}Message`] = msg.trim().slice(0, 500); delete d[`last_${kind}`];
    ctx.db.touch(); scheduler.start(ctx.yannajah, ctx.config);
    await ctx.reply(`✅ ${word} Time diset jam ${hhmm} (${ctx.config.bot.timezone})`);
  }
});
const toggleMute = mute => O({
  id: `owner.${mute ? '' : 'un'}mutegc`, name: `${mute ? '' : 'un'}mutegc`, aliases: [`${mute ? '' : 'un'}mutegc_proses`],
  description: `${mute ? 'Bisukan' : 'Aktifkan lagi'} bot di grup (di grup itu, atau dengan ID/nomor dari .listgc)`, usage: '[id grup|nomor]',
  async run(ctx) {
    let jid = ctx.m.isGroup && !ctx.args[0] ? ctx.m.chat : null;
    if (!jid) {
      const all = Object.values(await sock(ctx).groupFetchAllParticipating());
      const a = ctx.args[0] || '';
      jid = /^\d{1,3}$/.test(a) ? all[Number(a) - 1]?.id : a.endsWith('@g.us') ? a : a ? `${a}@g.us` : null;
      if (!jid) return ctx.reply(`Pilih grup:\n${all.slice(0, 50).map((g, i) => `${i + 1}. ${g.subject} ${ctx.db.get(['groups', g.id, 'mute']) ? '🔇' : ''}`).join('\n')}\n\n${ctx.prefix}${ctx.command} <nomor>`);
    }
    ctx.db.group(jid).mute = mute; ctx.db.touch();
    const name = (await sock(ctx).groupMetadata(jid).catch(() => null))?.subject || jid;
    await ctx.reply(`✅ Berhasil ${mute ? 'memute' : 'meng-unmute'} grup:\n*${name}*`);
  }
});
const joinReq = (action, word) => A({
  id: `group.${action}`, name: action === 'approve' ? 'acc' : 'tolakacc', aliases: action === 'approve' ? ['accjoin'] : ['rejectjoin'], botAdmin: true, limit: 1, usage: '[all|nomor]',
  description: `${word} permintaan bergabung grup: tanpa argumen = daftar, "all" = semua`,
  async run(ctx) {
    const pending = await sock(ctx).groupRequestParticipantsList(ctx.m.chat);
    if (!pending.length) return ctx.reply('✅ Tidak ada member yang minta bergabung.');
    const jidOf = p => p.phone_number || p.jid;
    if (!ctx.args[0]) return ctx.reply(`📋 *Permintaan bergabung* (${pending.length})\n\n${pending.map((p, i) => `${i + 1}. ${mention(jidOf(p))}`).join('\n')}\n\n${ctx.prefix}${ctx.command} all | ${ctx.prefix}${ctx.command} <nomor urut>`);
    const pick = ctx.args[0] === 'all' ? pending : [pending[Number(ctx.args[0]) - 1]].filter(Boolean);
    if (!pick.length) throw new UsageError('Nomor urut tidak ada.');
    await sock(ctx).groupRequestParticipantsUpdate(ctx.m.chat, pick.map(p => p.jid), action);
    await ctx.reply(`✅ ${pick.length} permintaan ${action === 'approve' ? 'diterima' : 'ditolak'}.`);
  }
});

module.exports = [
  timed('open', 'Dibuka'),
  timed('close', 'Ditutup'),
  daily('open', 'Open'),
  daily('close', 'Close'),
  A({ id: 'group.setopenmsg', name: 'setopen', description: 'Pesan saat grup dibuka oleh .opentime', usage: '<pesan>', async run(ctx) { ctx.group.openMessage = ctx.requireText().slice(0, 500); ctx.db.touch(); await ctx.reply(`✅ Pesan open grup diset: "${ctx.group.openMessage}"`); } }),
  A({ id: 'group.setclosemsg', name: 'setclose', description: 'Pesan saat grup ditutup oleh .closetime', usage: '<pesan>', async run(ctx) { ctx.group.closeMessage = ctx.requireText().slice(0, 500); ctx.db.touch(); await ctx.reply(`✅ Pesan close grup diset: "${ctx.group.closeMessage}"`); } }),
  G({ id: 'group.cekjadwal', name: 'cekjadwal', description: 'Lihat jadwal buka/tutup grup',
    async run(ctx) { const d = ctx.group.dailySchedule || {}; const t = ctx.group.timedSetting; await ctx.reply(`╭─❏ *Jadwal Grup*\n│▣ Tutup : ${d.closeTime || '❌ Belum diatur'}\n│▣ Buka : ${d.openTime || '❌ Belum diatur'}${t ? `\n│▣ ${t.action === 'open' ? 'Buka' : 'Tutup'} sekali : ${Math.max(0, Math.round((t.at - Date.now()) / 60000))} menit lagi` : ''}\n│▣ Status : ${ctx.m.groupMetadata?.announce ? '🔒 TERTUTUP' : '🔓 TERBUKA'}\n╰──────────❏`); } }),
  A({ id: 'group.resetjadwal', name: 'resetjadwal', description: 'Hapus jadwal buka/tutup grup', async run(ctx) { delete ctx.group.dailySchedule; delete ctx.group.timedSetting; ctx.db.touch(); await ctx.reply('✅ Jadwal buka/tutup grup dihapus.'); } }),
  A({ id: 'group.schedule', name: 'schedule', description: 'Posting bulanan otomatis + hidetag: .schedule <pesan>|<tanggal 1-31> (boleh kirim/reply media), list, delete <no>, clear', usage: '<pesan>|<tanggal>',
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
    } }),
  toggleMute(true),
  toggleMute(false),
  O({ id: 'owner.onlygc', name: 'onlygc', aliases: ['onlygrup', 'onlygroup'], description: 'Bot hanya merespons di grup (chat pribadi diabaikan, kecuali owner)', usage: 'on/off',
    async run(ctx) { const v = (ctx.args[0] || '').toLowerCase(); const st = ctx.db.settings(); if (!['on', 'off'].includes(v)) return ctx.reply(`⚙️ *Mode Hanya Grup: ${st.onlyGroup ? '✅ AKTIF' : '❌ NONAKTIF'}*\n${ctx.usage()}`); st.onlyGroup = v === 'on'; ctx.db.touch(); await ctx.reply(v === 'on' ? '✅ Mode "Hanya Grup" diaktifkan.' : '❌ Mode "Hanya Grup" dinonaktifkan.'); },
    async onMessage(ctx) { return Boolean(ctx.db.settings().onlyGroup && !ctx.m.isGroup && !ctx.isOwner); } }),
  A({ id: 'group.antibot', name: 'antibot', description: 'Hapus (dan kick) pesan dari bot lain: .antibot delete on | .antibot kick on', usage: '<delete|kick> <on|off>',
    async run(ctx) {
      const [mode, v] = ctx.args.map(x => x.toLowerCase());
      if (!['delete', 'kick'].includes(mode) || !['on', 'off'].includes(v)) return ctx.reply(`🔧 *ANTI-BOT*\nDelete: ${ctx.group.antibot ? '✅' : '❌'}\nKick: ${ctx.group.antibotkick ? '✅' : '❌'}\n\n${ctx.prefix}antibot delete on\n${ctx.prefix}antibot kick off`);
      ctx.group[mode === 'kick' ? 'antibotkick' : 'antibot'] = v === 'on'; if (mode === 'kick' && v === 'on') ctx.group.antibot = true; ctx.db.touch();
      await ctx.reply(`✅ Antibot ${mode} ${v === 'on' ? 'aktif' : 'nonaktif'}.`);
    },
    async onMessage(ctx) {
      const m = ctx.m; if (!m.isGroup || m.fromMe || !BOT_ID.test(m.key?.id || '') || ctx.isAdmin || ctx.isOwner) return false;
      const g = ctx.db.get(['groups', m.chat]); if (!g?.antibot || !ctx.isBotAdmin) return false;
      await ctx.yannajah.sendmessage(m.chat, { delete: m.key }).catch(() => {});
      if (g.antibotkick) await ctx.yannajah.socket?.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch(() => {});
      return true;
    } }),
  A({ id: 'group.hidetagpoll', name: 'hidetagpoll', limit: 1, description: 'Poll dengan tag semua member: .hidetagpoll Pertanyaan?|Opsi1,Opsi2,Opsi3', usage: '<pertanyaan>|<opsi1,opsi2,...>',
    async run(ctx) {
      const [q, opts] = ctx.requireText().split('|'); const values = String(opts || '').split(',').map(x => x.trim()).filter(Boolean);
      if (!q?.trim() || values.length < 2 || values.length > 12) throw new UsageError(`❌ Format: ${ctx.prefix}hidetagpoll Menu makan siang?|Nasi Goreng,Mie Ayam,Bakso`);
      await ctx.yannajah.sendmessage(ctx.m.chat, { poll: { name: q.trim().slice(0, 255), values: values.map(v => v.slice(0, 100)), selectableCount: 1 }, mentions: (ctx.m.groupMetadata?.participants || []).map(p => p.id) });
    } }),
  O({ id: 'owner.creategc', name: 'creategc', aliases: ['creategroup', 'creategrup'], description: 'Buat grup baru (kamu dijadikan member)', usage: '<nama grup>',
    async run(ctx) {
      const name = ctx.requireText('❌ Masukkan nama grup. Contoh: .creategc Nama Grup').slice(0, 100);
      const g = await sock(ctx).groupCreate(name, [ctx.m.sender]);
      const code = await sock(ctx).groupInviteCode(g.id).catch(() => null);
      await sock(ctx).groupParticipantsUpdate(g.id, [ctx.m.sender], 'promote').catch(() => {});
      await ctx.reply(`✅ *Berhasil Membuat Grup*\n\n📛 Nama: ${name}\n🆔 ID: ${g.id}${code ? `\n🔗 Link: https://chat.whatsapp.com/${code}` : ''}`);
    } }),
  A({ id: 'group.setppgc', name: 'setppgc', aliases: ['setppgrup'], botAdmin: true, description: 'Ganti foto grup (kirim/reply gambar)',
    async run(ctx) { const md = ctx.media(); if (!md || !/image\/(jpe?g|png)/.test(md.mime)) throw new UsageError('❌ Kirim/reply gambar JPG/PNG.'); await sock(ctx).updateProfilePicture(ctx.m.chat, await md.download()); await ctx.reply('✅ Foto grup diganti.'); } }),
  G({ id: 'group.idgc', name: 'idgc', aliases: ['cekidgc', 'getidgc'], description: 'ID grup ini', async run(ctx) { await ctx.reply(`🆔 *${ctx.m.groupMetadata?.subject || 'Grup'}*\n${ctx.m.chat}`); } }),
  joinReq('approve', 'Terima'),
  joinReq('reject', 'Tolak'),
  A({ id: 'group.testwelcome', name: 'testwelcome', description: 'Tes pesan welcome grup', async run(ctx) { await ctx.reply(render(ctx.group.welcomeText || DEFAULT_WELCOME, { user: ctx.m.sender, group: ctx.m.groupMetadata?.subject || 'grup', desc: ctx.m.groupMetadata?.desc || '', count: ctx.m.groupMetadata?.participants?.length || 0 })); } }),
  A({ id: 'group.testleft', name: 'testleft', description: 'Tes pesan left grup', async run(ctx) { await ctx.reply(render(ctx.group.leftText || DEFAULT_LEFT, { user: ctx.m.sender, group: ctx.m.groupMetadata?.subject || 'grup', desc: ctx.m.groupMetadata?.desc || '', count: ctx.m.groupMetadata?.participants?.length || 0 })); } }),
  O({ id: 'owner.setlabel', name: 'setlabel', description: 'Atur label member bot di grup: .setlabel <id grup|all>|<label maks 30>', usage: '<idgc|all>|<label>',
    async run(ctx) {
      const [target, label] = ctx.requireText().split('|').map(x => x?.trim());
      if (!target || !label || label.length > 30) throw new UsageError(`Format: ${ctx.prefix}setlabel all|Bot Resmi (label maks 30 karakter)`);
      const all = Object.keys(await sock(ctx).groupFetchAllParticipating());
      const ids = target.toLowerCase() === 'all' ? all : [target.endsWith('@g.us') ? target : `${target}@g.us`];
      if (!ids.every(j => all.includes(j))) throw new UsageError('❌ Bot tidak berada di grup itu.');
      let ok = 0;
      for (const j of ids.slice(0, 200)) {
        await sock(ctx).relayMessage(j, { protocolMessage: { type: 30, memberLabel: { label } } }, { additionalNodes: [{ tag: 'meta', attrs: { tag_reason: 'user_update', appdata: 'member_tag' } }] }).then(() => ok++).catch(() => {});
        await new Promise(r => setTimeout(r, 500));
      }
      await ctx.reply(`✅ Label diset di ${ok}/${ids.length} grup.`);
    } }),
  G({ id: 'group.mywarn', name: 'mywarn', aliases: ['infowarn'], description: 'Cek jumlah peringatan (kamu atau @user)', usage: '[@user]',
    async run(ctx) { const t = targetJid(ctx, { self: true }); const n = ctx.group.warns?.[t] || 0; await ctx.reply(n ? `⚠️ ${mention(t)} punya ${n}/${ctx.config.limit.warnBeforeKick} peringatan.` : `✅ ${mention(t)} tidak memiliki peringatan aktif.`); } }),
  A({ id: 'group.resetwarn', name: 'resetwarn', description: 'Reset peringatan @user, atau semua member jika tanpa target', usage: '[@user]',
    async run(ctx) { const has = ctx.m.mentionedJid?.length || ctx.m.quoted || ctx.args.length; if (has) { const t = targetJid(ctx); if (!ctx.group.warns?.[t]) throw new UsageError(`❌ ${mention(t)} tidak ada warn.`); delete ctx.group.warns[t]; ctx.db.touch(); return ctx.reply(`✅ Warn ${mention(t)} direset.`); } const n = Object.keys(ctx.group.warns || {}).length; ctx.group.warns = {}; ctx.db.touch(); await ctx.reply(`✅ Warn ${n} member direset.`); } })
];
