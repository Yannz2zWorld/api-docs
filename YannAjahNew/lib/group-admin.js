'use strict';
// Tools admin grup V15: buka/tutup grup berwaktu & terjadwal harian, posting bulanan, mute grup
// (owner), mode hanya-grup, anti bot lain, poll hidetag, buat grup, foto grup, ID grup,
// permintaan bergabung, tes welcome/left, label member bot, info & reset warn.
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const scheduler = require('../library/scheduler');
const media = require('../library/mediastore');
const { targetJid, mention } = require('../library/targets');
const { render, DEFAULT_WELCOME, DEFAULT_LEFT } = require('./welcome');

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

module.exports = { G, A, O, sock, BOT_ID, timed, daily, toggleMute, joinReq };
