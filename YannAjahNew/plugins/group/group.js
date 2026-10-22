'use strict';
// Manajemen grup (V15 menu-group). Semua aksi lewat API grup Baileys:
// groupParticipantsUpdate, groupSettingUpdate, groupInviteCode, groupRevokeInvite,
// groupUpdateSubject, groupUpdateDescription, groupLeave, groupAcceptInvite.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { jidUser, normalizePhone, toJid } = require('../../library/function');

const G = (f) => feature({ category: 'group', scope: 'group', ...f });
const sock = ctx => { const s = ctx.yannajah.socket; if (!s) throw new UsageError('Bot belum terhubung.'); return s; };

// Target: mention, reply, atau nomor di argumen.
function targets(ctx) {
  const out = new Set(ctx.m.mentionedJid || []);
  if (ctx.m.quoted?.sender) out.add(ctx.m.quoted.sender);
  for (const a of ctx.args) { const p = normalizePhone(a.replace(/^@/, '')); if (p) out.add(toJid(p)); }
  return [...out].filter(j => j !== `${jidUser(ctx.yannajah.socket?.user?.id || '')}@s.whatsapp.net`);
}
function needTargets(ctx) { const t = targets(ctx); if (!t.length) throw new UsageError(`Tag/reply anggota atau tulis nomornya. ${ctx.usage()}`); return t.slice(0, 20); }

const toggle = (key, label, extra = {}) => G({
  id: `group.${key}`, name: key, category: 'group', description: `Nyalakan/matikan ${label}: .${key} on/off`, usage: 'on/off', permission: 'admin', ...extra,
  async run(ctx) {
    const v = (ctx.args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(v)) return ctx.reply(`${label}: *${ctx.group[extra.field || key] ? 'ON' : 'OFF'}*\n${ctx.usage()}`);
    ctx.group[extra.field || key] = v === 'on';
    ctx.db.touch();
    await ctx.reply(`✅ ${label} ${v === 'on' ? 'dinyalakan' : 'dimatikan'}.`);
  }
});

const LINK_RE = /chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/i;

module.exports = [
  G({ id: 'group.kick', name: 'kick', aliases: ['kik', 'tendang'], description: 'Keluarkan anggota (tag/reply/nomor)', usage: '@user', permission: 'admin', botAdmin: true,
    async run(ctx) { const t = needTargets(ctx); await sock(ctx).groupParticipantsUpdate(ctx.m.chat, t, 'remove'); await ctx.reply(`✅ ${t.length} anggota dikeluarkan.`); } }),
  G({ id: 'group.add', name: 'add', description: 'Tambahkan anggota dengan nomor (hanya nomor yang mengizinkan)', usage: '<nomor>', permission: 'admin', botAdmin: true, cooldown: 10,
    async run(ctx) {
      const t = needTargets(ctx).slice(0, 5);
      const res = await sock(ctx).groupParticipantsUpdate(ctx.m.chat, t, 'add');
      const lines = (res || []).map(r => `${jidUser(r.jid)}: ${r.status === '200' ? '✅ ditambahkan' : r.status === '403' ? '🔒 perlu undangan (privasi)' : r.status === '409' ? 'sudah di grup' : `gagal (${r.status})`}`);
      await ctx.reply(lines.join('\n') || 'Selesai.');
    } }),
  G({ id: 'group.promote', name: 'promote', aliases: ['jadiadmin'], description: 'Jadikan admin', usage: '@user', permission: 'admin', botAdmin: true,
    async run(ctx) { const t = needTargets(ctx); await sock(ctx).groupParticipantsUpdate(ctx.m.chat, t, 'promote'); await ctx.reply(`✅ ${t.map(j => '@' + jidUser(j)).join(', ')} sekarang admin.`); } }),
  G({ id: 'group.demote', name: 'demote', description: 'Copot admin', usage: '@user', permission: 'admin', botAdmin: true,
    async run(ctx) { const t = needTargets(ctx); await sock(ctx).groupParticipantsUpdate(ctx.m.chat, t, 'demote'); await ctx.reply(`✅ ${t.map(j => '@' + jidUser(j)).join(', ')} bukan admin lagi.`); } }),
  G({ id: 'group.open', name: 'opengc', aliases: ['bukagrup', 'open'], description: 'Buka grup (semua anggota bisa kirim pesan)', permission: 'admin', botAdmin: true,
    async run(ctx) { await sock(ctx).groupSettingUpdate(ctx.m.chat, 'not_announcement'); await ctx.reply('🔓 Grup dibuka.'); } }),
  G({ id: 'group.close', name: 'closegc', aliases: ['tutupgrup', 'close'], description: 'Tutup grup (hanya admin yang bisa kirim pesan)', permission: 'admin', botAdmin: true,
    async run(ctx) { await sock(ctx).groupSettingUpdate(ctx.m.chat, 'announcement'); await ctx.reply('🔒 Grup ditutup.'); } }),
  G({ id: 'group.lockinfo', name: 'lockinfo', description: 'Kunci info grup (hanya admin yang bisa ubah info)', usage: 'on/off', permission: 'admin', botAdmin: true,
    async run(ctx) { const v = ctx.args[0]; if (!['on', 'off'].includes(v)) throw new UsageError(ctx.usage()); await sock(ctx).groupSettingUpdate(ctx.m.chat, v === 'on' ? 'locked' : 'unlocked'); await ctx.reply(`✅ Info grup ${v === 'on' ? 'dikunci' : 'dibuka'}.`); } }),
  G({ id: 'group.link', name: 'linkgc', aliases: ['linkgrup'], description: 'Link undangan grup', botAdmin: true,
    async run(ctx) { await ctx.reply(`https://chat.whatsapp.com/${await sock(ctx).groupInviteCode(ctx.m.chat)}`); } }),
  G({ id: 'group.revoke', name: 'resetlinkgc', aliases: ['revoke'], description: 'Reset link undangan grup', permission: 'admin', botAdmin: true,
    async run(ctx) { await ctx.reply(`✅ Link baru: https://chat.whatsapp.com/${await sock(ctx).groupRevokeInvite(ctx.m.chat)}`); } }),
  G({ id: 'group.setname', name: 'setnamagc', aliases: ['setsubject'], description: 'Ganti nama grup', usage: '<nama>', permission: 'admin', botAdmin: true,
    async run(ctx) { const t = ctx.requireText(); if (t.length > 100) throw new UsageError('Nama grup maks 100 karakter.'); await sock(ctx).groupUpdateSubject(ctx.m.chat, t); await ctx.reply('✅ Nama grup diganti.'); } }),
  G({ id: 'group.setdesc', name: 'setdesc', aliases: ['setdeskripsi'], description: 'Ganti deskripsi grup', usage: '<deskripsi>', permission: 'admin', botAdmin: true,
    async run(ctx) { const t = ctx.requireText(); if (t.length > 2000) throw new UsageError('Deskripsi maks 2000 karakter.'); await sock(ctx).groupUpdateDescription(ctx.m.chat, t); await ctx.reply('✅ Deskripsi grup diganti.'); } }),
  G({ id: 'group.info', name: 'groupinfo', aliases: ['infogrup', 'gcinfo'], description: 'Info grup: nama, anggota, admin, pengaturan bot',
    async run(ctx) {
      const md = ctx.m.groupMetadata || await sock(ctx).groupMetadata(ctx.m.chat);
      const admins = md.participants.filter(p => p.admin).length;
      const g = ctx.group;
      await ctx.reply([`*${md.subject}*`, `Anggota: ${md.participants.length} (admin ${admins})`, `Dibuat: ${md.creation ? new Date(md.creation * 1000).toLocaleDateString('id-ID') : '-'}`, `Pesan: ${md.announce ? 'hanya admin' : 'semua'}`, `Welcome: ${g.welcome ? 'on' : 'off'} · Left: ${g.left ? 'on' : 'off'} · Antilink: ${g.antilink ? 'on' : 'off'} · Mute bot: ${g.mute ? 'on' : 'off'}`, md.desc ? `\n${String(md.desc).slice(0, 500)}` : ''].join('\n'));
    } }),
  G({ id: 'group.listadmin', name: 'listadmin', aliases: ['tagadmin', 'admins'], description: 'Daftar (dan tag) admin grup',
    async run(ctx) {
      const md = ctx.m.groupMetadata || await sock(ctx).groupMetadata(ctx.m.chat);
      const admins = md.participants.filter(p => p.admin).map(p => p.phoneNumber || p.id);
      await ctx.yannajah.sendmessage(ctx.m.chat, { text: `👮 Admin grup:\n${admins.map((j, i) => `${i + 1}. @${jidUser(j)}`).join('\n')}`, mentions: admins }, { quoted: ctx.m.raw });
    } }),
  G({ id: 'group.tagall', name: 'tagall', aliases: ['everyone'], description: 'Tag semua anggota (dengan daftar)', usage: '[pesan]', permission: 'admin', cooldown: 60,
    async run(ctx) {
      const md = ctx.m.groupMetadata || await sock(ctx).groupMetadata(ctx.m.chat);
      const all = md.participants.map(p => p.phoneNumber || p.id);
      await ctx.yannajah.sendmessage(ctx.m.chat, { text: `📢 ${ctx.text || 'Perhatian semua!'}\n\n${all.map(j => `• @${jidUser(j)}`).join('\n')}`, mentions: all });
    } }),
  G({ id: 'group.hidetag', name: 'hidetag', aliases: ['ht', 'h'], description: 'Kirim pesan yang men-tag semua anggota tanpa daftar', usage: '<pesan>', permission: 'admin', cooldown: 60,
    async run(ctx) {
      const md = ctx.m.groupMetadata || await sock(ctx).groupMetadata(ctx.m.chat);
      const text = ctx.text || ctx.m.quoted?.text;
      if (!text) throw new UsageError(ctx.usage());
      await ctx.yannajah.sendmessage(ctx.m.chat, { text, mentions: md.participants.map(p => p.phoneNumber || p.id) });
    } }),
  G({ id: 'group.delete', name: 'del', aliases: ['delete', 'hapus'], description: 'Hapus pesan yang di-reply (pesan bot, atau pesan anggota jika bot admin)', permission: 'admin',
    async run(ctx) {
      const q = ctx.m.quoted;
      if (!q) throw new UsageError('Reply pesan yang mau dihapus.');
      if (!q.key.fromMe && !ctx.m.isBotAdmin) throw new UsageError('Bot harus admin untuk menghapus pesan anggota.');
      await ctx.yannajah.sendmessage(ctx.m.chat, { delete: { remoteJid: ctx.m.chat, fromMe: q.key.fromMe, id: q.id, participant: q.senderRaw } });
    } }),
  toggle('welcome', 'Pesan selamat datang'),
  toggle('left', 'Pesan perpisahan'),
  toggle('antilink', 'Anti link grup WhatsApp lain', { botAdmin: true }),
  toggle('mute', 'Mute bot di grup ini (bot hanya merespons owner)', { allowWhenMuted: true }),
  toggle('onlyadmin', 'Mode hanya admin yang bisa pakai bot', { field: 'onlyAdmin', allowWhenMuted: true }),
  G({ id: 'group.setwelcome', name: 'setwelcome', description: 'Atur teks welcome (@user @group @desc @count)', usage: '<teks>', permission: 'admin',
    async run(ctx) { ctx.group.welcomeText = ctx.requireText().slice(0, 1000); ctx.db.touch(); await ctx.reply('✅ Teks welcome disimpan.'); } }),
  G({ id: 'group.setleft', name: 'setleft', description: 'Atur teks perpisahan (@user @group @count)', usage: '<teks>', permission: 'admin',
    async run(ctx) { ctx.group.leftText = ctx.requireText().slice(0, 1000); ctx.db.touch(); await ctx.reply('✅ Teks perpisahan disimpan.'); } }),
  G({ id: 'group.warn', name: 'warn', aliases: ['peringatan'], description: 'Beri peringatan; kena batas = dikeluarkan (kalau bot admin)', usage: '@user [alasan]', permission: 'admin',
    async run(ctx) {
      const [t] = needTargets(ctx);
      const warns = ctx.group.warns = ctx.group.warns || {};
      warns[t] = (warns[t] || 0) + 1; ctx.db.touch();
      const max = ctx.config.limit.warnBeforeKick;
      await ctx.yannajah.sendmessage(ctx.m.chat, { text: `⚠️ @${jidUser(t)} mendapat peringatan ${warns[t]}/${max}${ctx.args.slice(1).length ? `\nAlasan: ${ctx.args.slice(1).join(' ').replace(/@\d+/g, '').trim()}` : ''}`, mentions: [t] });
      if (warns[t] >= max) {
        delete warns[t]; ctx.db.touch();
        if (ctx.m.isBotAdmin) { await sock(ctx).groupParticipantsUpdate(ctx.m.chat, [t], 'remove'); await ctx.reply('🚫 Batas peringatan tercapai, anggota dikeluarkan.'); }
        else await ctx.reply('🚫 Batas peringatan tercapai, tetapi bot bukan admin sehingga tidak bisa mengeluarkan.');
      }
    } }),
  G({ id: 'group.unwarn', name: 'delwarn', aliases: ['unwarn'], description: 'Hapus peringatan anggota', usage: '@user', permission: 'admin',
    async run(ctx) { const [t] = needTargets(ctx); if (ctx.group.warns) delete ctx.group.warns[t]; ctx.db.touch(); await ctx.reply('✅ Peringatan dihapus.'); } }),
  G({ id: 'group.listwarn', name: 'listwarn', aliases: ['cekwarn'], description: 'Daftar peringatan di grup ini',
    async run(ctx) {
      const w = Object.entries(ctx.group.warns || {});
      if (!w.length) return ctx.reply('Tidak ada anggota yang punya peringatan.');
      await ctx.yannajah.sendmessage(ctx.m.chat, { text: w.map(([j, n]) => `@${jidUser(j)}: ${n}/${ctx.config.limit.warnBeforeKick}`).join('\n'), mentions: w.map(x => x[0]) }, { quoted: ctx.m.raw });
    } }),
  G({ id: 'group.leave', name: 'leave', aliases: ['keluar'], description: 'Bot keluar dari grup ini', permission: 'owner',
    async run(ctx) { await ctx.reply('👋 Bot keluar dari grup.'); await sock(ctx).groupLeave(ctx.m.chat); } }),
  G({ id: 'group.antilink.hook', name: 'antilinkstatus', description: 'Status anti-link grup ini', permission: 'admin',
    async run(ctx) { await ctx.reply(`Anti-link: *${ctx.group.antilink ? 'ON' : 'OFF'}*`); },
    // Hook anti-link: hapus pesan berisi link grup lain dari non-admin (butuh bot admin).
    async onMessage(ctx) {
      const m = ctx.m;
      if (!m.isGroup || m.fromMe || ctx.isOwner || m.isAdmin || !m.isBotAdmin) return false;
      const g = ctx.db.get(`groups.${m.chat}`);
      if (!g?.antilink) return false;
      const link = LINK_RE.exec(m.body || '');
      if (!link) return false;
      const own = await sock(ctx).groupInviteCode(m.chat).catch(() => null);
      if (own && link[1] === own) return false;
      await ctx.yannajah.sendmessage(m.chat, { delete: m.key });
      await ctx.yannajah.sendmessage(m.chat, { text: `🔗 @${jidUser(m.sender)} link grup lain tidak diizinkan di sini.`, mentions: [m.sender] });
      return true;
    } })
];
module.exports.targets = targets;
