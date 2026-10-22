'use strict';
// Command owner (V15 menu-owner) yang aman. Sengaja TIDAK ada: eval/exec dari chat, broadcast massal
// (jpm/pushkontak), dan ambil-alih grup — lihat docs/FEATURES.md bagian "dikecualikan".
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { jidUser, normalizePhone, toJid } = require('../../library/function');

const O = f => feature({ category: 'owner', permission: 'owner', cooldown: 1, allowInMaintenance: true, ...f });
const sock = ctx => { const s = ctx.yannajah.socket; if (!s) throw new UsageError('Bot belum terhubung.'); return s; };
function targetNumber(ctx) {
  const j = ctx.m.mentionedJid?.[0] || ctx.m.quoted?.sender;
  if (j) return jidUser(j);
  const p = normalizePhone(ctx.args[0] || '');
  if (!p) throw new UsageError(`Tag/reply user atau tulis nomornya. ${ctx.usage()}`);
  return p;
}
const onOff = (ctx, key, label) => {
  const v = (ctx.args[0] || '').toLowerCase();
  const s = ctx.db.settings();
  if (!['on', 'off'].includes(v)) return ctx.reply(`${label}: *${s[key] ? 'ON' : 'OFF'}*\n${ctx.usage()}`);
  s[key] = v === 'on'; ctx.db.touch();
  return ctx.reply(`✅ ${label} ${v === 'on' ? 'dinyalakan' : 'dimatikan'}.`);
};

module.exports = [
  O({ id: 'owner.self', name: 'self', description: 'Mode self: bot hanya merespons owner', async run(ctx) { ctx.db.settings().public = false; ctx.db.touch(); await ctx.reply('🔒 Mode SELF aktif.'); } }),
  O({ id: 'owner.public', name: 'public', description: 'Mode public: bot merespons semua orang', async run(ctx) { ctx.db.settings().public = true; ctx.db.touch(); await ctx.reply('🌐 Mode PUBLIC aktif.'); } }),
  O({ id: 'owner.autoread', name: 'autoread', description: 'Tandai pesan masuk sebagai dibaca otomatis', usage: 'on/off', run: ctx => onOff(ctx, 'autoread', 'Autoread') }),
  O({ id: 'owner.autotyping', name: 'autotyping', description: 'Tampilkan "mengetik..." saat memproses command', usage: 'on/off', run: ctx => onOff(ctx, 'autotyping', 'Autotyping') }),
  O({ id: 'owner.setprefix', name: 'setprefix', description: 'Atur prefix (pisah spasi, 1-3 karakter). Kosong = kembali ke settingsbot.js', usage: '[prefix...]',
    async run(ctx) {
      const list = ctx.args.filter(p => p.length >= 1 && p.length <= 3 && !/\s/.test(p)).slice(0, 6);
      ctx.db.settings().prefix = list; ctx.db.touch();
      await ctx.reply(list.length ? `✅ Prefix: ${list.join(' ')}` : `✅ Prefix kembali ke default: ${ctx.config.prefix.list.join(' ')}`);
    } }),
  O({ id: 'owner.addowner', name: 'addowner', aliases: ['addown'], description: 'Tambah owner bot (disimpan di database lokal)', usage: '<nomor/@tag>',
    async run(ctx) { const n = targetNumber(ctx); const list = ctx.db.raw().owners; if (n === ctx.config.owner.number || list.includes(n)) return ctx.reply('Nomor itu sudah owner.'); list.push(n); ctx.db.touch(); ctx.logger.info('owner ditambah', { by: ctx.m.senderNumber.slice(0, 4) + '…' }); await ctx.reply(`✅ ${n} ditambahkan sebagai owner.`); } }),
  O({ id: 'owner.delowner', name: 'delowner', aliases: ['delown'], description: 'Hapus owner tambahan', usage: '<nomor/@tag>',
    async run(ctx) { const n = targetNumber(ctx); const list = ctx.db.raw().owners; const i = list.indexOf(n); if (i < 0) return ctx.reply('Nomor itu bukan owner tambahan (owner utama diatur di settingsbot.js).'); list.splice(i, 1); ctx.db.touch(); await ctx.reply(`✅ ${n} dihapus dari owner.`); } }),
  O({ id: 'owner.listowner', name: 'listowner', aliases: ['listown'], description: 'Daftar owner', async run(ctx) { await ctx.reply([`👑 ${ctx.config.owner.number} (utama)`, ...ctx.config.owner.extra.map(n => `• ${n} (settingsbot)`), ...ctx.db.raw().owners.map(n => `• ${n}`)].join('\n')); } }),
  O({ id: 'owner.addprem', name: 'addprem', aliases: ['addpremium'], description: 'Tambah premium: .addprem <nomor/@tag> <hari>', usage: '<nomor/@tag> <hari>',
    async run(ctx) {
      const n = targetNumber(ctx);
      const days = Number(ctx.args.find(a => /^\d{1,4}$/.test(a) && a !== n) || 30);
      if (days < 1 || days > 3650) throw new UsageError('Hari 1-3650.');
      const u = ctx.db.user(toJid(n));
      u.premiumUntil = Math.max(u.premiumUntil || 0, Date.now()) + days * 86400000; ctx.db.touch();
      await ctx.reply(`💎 ${n} premium sampai ${new Date(u.premiumUntil).toLocaleString('id-ID')}`);
    } }),
  O({ id: 'owner.delprem', name: 'delprem', description: 'Cabut premium user', usage: '<nomor/@tag>', async run(ctx) { const u = ctx.db.user(toJid(targetNumber(ctx))); u.premiumUntil = 0; ctx.db.touch(); await ctx.reply('✅ Premium dicabut.'); } }),
  O({ id: 'owner.listprem', name: 'listprem', description: 'Daftar user premium aktif',
    async run(ctx) { const list = Object.entries(ctx.db.raw().users).filter(([, u]) => u.premiumUntil > Date.now()); await ctx.reply(list.length ? list.map(([j, u]) => `• ${jidUser(j)} — s/d ${new Date(u.premiumUntil).toLocaleDateString('id-ID')}`).join('\n') : 'Belum ada user premium.'); } }),
  O({ id: 'owner.ban', name: 'banuser', aliases: ['blacklist'], description: 'Blokir user dari memakai bot (lokal)', usage: '<nomor/@tag>',
    async run(ctx) { const n = targetNumber(ctx); if (n === ctx.config.owner.number) throw new UsageError('Tidak bisa ban owner utama.'); ctx.db.user(toJid(n)).banned = true; ctx.db.touch(); await ctx.reply(`🚫 ${n} tidak bisa memakai bot.`); } }),
  O({ id: 'owner.unban', name: 'unbanuser', aliases: ['unblacklist'], description: 'Buka blokir user', usage: '<nomor/@tag>', async run(ctx) { ctx.db.user(toJid(targetNumber(ctx))).banned = false; ctx.db.touch(); await ctx.reply('✅ Blokir dibuka.'); } }),
  O({ id: 'owner.listban', name: 'listban', description: 'Daftar user yang diblokir dari bot', async run(ctx) { const l = Object.entries(ctx.db.raw().users).filter(([, u]) => u.banned).map(([j]) => `• ${jidUser(j)}`); await ctx.reply(l.join('\n') || 'Tidak ada.'); } }),
  O({ id: 'owner.addlimit', name: 'addlimit', description: 'Tambah limit user: .addlimit <nomor/@tag> <jumlah>', usage: '<nomor/@tag> <jumlah>',
    async run(ctx) { const n = targetNumber(ctx); const k = Number(ctx.args.find(a => /^\d{1,5}$/.test(a) && a !== n)); if (!k) throw new UsageError(ctx.usage()); const u = ctx.db.user(toJid(n)); u.limit += k; ctx.db.touch(); await ctx.reply(`✅ Limit ${n} sekarang ${u.limit}.`); } }),
  O({ id: 'owner.block', name: 'block', description: 'Blokir kontak di WhatsApp', usage: '<nomor/@tag>', async run(ctx) { await sock(ctx).updateBlockStatus(toJid(targetNumber(ctx)), 'block'); await ctx.reply('✅ Diblokir.'); } }),
  O({ id: 'owner.unblock', name: 'unblock', description: 'Buka blokir kontak di WhatsApp', usage: '<nomor/@tag>', async run(ctx) { await sock(ctx).updateBlockStatus(toJid(targetNumber(ctx)), 'unblock'); await ctx.reply('✅ Blokir dibuka.'); } }),
  O({ id: 'owner.setbio', name: 'setbio', description: 'Ganti bio/status bot', usage: '<teks>', async run(ctx) { const t = ctx.requireText(); if (t.length > 139) throw new UsageError('Bio maks 139 karakter.'); await sock(ctx).updateProfileStatus(t); await ctx.reply('✅ Bio diganti.'); } }),
  O({ id: 'owner.setbotname', name: 'setbotname', description: 'Ganti nama profil WhatsApp bot', usage: '<nama>', async run(ctx) { const t = ctx.requireText(); if (t.length > 25) throw new UsageError('Nama maks 25 karakter.'); await sock(ctx).updateProfileName(t); await ctx.reply('✅ Nama profil diganti.'); } }),
  O({ id: 'owner.setppbot', name: 'setppbot', description: 'Ganti foto profil bot (reply/kirim gambar)',
    async run(ctx) { const md = ctx.media(); if (!md || !/image/.test(md.mime)) throw new UsageError('Kirim/reply gambar.'); const buf = await md.download(); await sock(ctx).updateProfilePicture(sock(ctx).user.id, buf); await ctx.reply('✅ Foto profil bot diganti.'); } }),
  O({ id: 'owner.join', name: 'join', aliases: ['joingc'], description: 'Bot masuk grup lewat link undangan', usage: '<link>',
    async run(ctx) { const m = /chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/.exec(ctx.text); if (!m) throw new UsageError('Link grup tidak valid.'); const id = await sock(ctx).groupAcceptInvite(m[1]); await ctx.reply(`✅ Bergabung ke grup ${id || ''}`); } }),
  O({ id: 'owner.listgc', name: 'listgc', aliases: ['listgroup'], description: 'Daftar grup yang diikuti bot',
    async run(ctx) { const all = Object.values(await sock(ctx).groupFetchAllParticipating()); await ctx.reply(`📋 ${all.length} grup:\n` + all.slice(0, 100).map((g, i) => `${i + 1}. ${g.subject} (${g.participants.length})`).join('\n')); } }),
  O({ id: 'owner.feature.disable', name: 'disablefitur', aliases: ['matikanfitur'], description: 'Nonaktifkan fitur (disimpan di database)', usage: '<command>',
    async run(ctx) { const f = ctx.yannajah.plugins.disable(ctx.requireText().split(/\s+/)[0]); if (!f) throw new UsageError('Command tidak ditemukan.'); if (f.category === 'owner') { ctx.yannajah.plugins.enable(f.id); throw new UsageError('Fitur owner tidak bisa dimatikan.'); } ctx.db.touch(); await ctx.reply(`⛔ ${f.name} dinonaktifkan.`); } }),
  O({ id: 'owner.feature.enable', name: 'enablefitur', aliases: ['nyalakanfitur'], description: 'Aktifkan lagi fitur', usage: '<command>',
    async run(ctx) { const f = ctx.yannajah.plugins.enable(ctx.requireText().split(/\s+/)[0]); if (!f) throw new UsageError('Command tidak ditemukan.'); ctx.db.touch(); await ctx.reply(`✅ ${f.name} diaktifkan.`); } }),
  O({ id: 'owner.backupdb', name: 'backupdb', aliases: ['backup'], description: 'Kirim file database lokal bot ke chat pribadi owner', scope: 'private',
    async run(ctx) { await ctx.db.save(); const buf = Buffer.from(JSON.stringify(ctx.db.raw(), null, 1)); await ctx.yannajah.sendFile(ctx.m.chat, { buffer: buf, mime: 'application/json' }, { asDocument: true, fileName: `database-${new Date().toISOString().slice(0, 10)}.json`, quoted: ctx.m.raw }); } }),
  O({ id: 'owner.resetlimit', name: 'resetlimitall', description: 'Reset limit harian semua user ke nilai default',
    async run(ctx) { let n = 0; for (const u of Object.values(ctx.db.raw().users)) { u.limit = ctx.config.limit.daily; n++; } ctx.db.touch(); await ctx.reply(`✅ Limit ${n} user direset.`); } })
];
