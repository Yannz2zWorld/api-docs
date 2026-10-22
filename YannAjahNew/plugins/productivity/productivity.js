'use strict';
// Produktivitas pribadi per user: catatan, to-do, pengingat (disimpan di database lokal bot).
// Pengingat dicek tiap 30 detik oleh hook; tetap tersimpan setelah restart.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

const P = f => feature({ category: 'productivity', ...f });
const MAX_ITEMS = 50;
const list = (ctx, key) => (ctx.user[key] = Array.isArray(ctx.user[key]) ? ctx.user[key] : []);

function parseDuration(s) {
  const m = /^(\d{1,4})\s*(s|detik|m|menit|j|jam|h|hari|d)$/i.exec(String(s || '').trim());
  if (!m) return null;
  const mult = { s: 1, detik: 1, m: 60, menit: 60, j: 3600, jam: 3600, h: 86400, hari: 86400, d: 86400 }[m[2].toLowerCase()];
  const sec = Number(m[1]) * mult;
  return sec >= 10 && sec <= 30 * 86400 ? sec * 1000 : null;
}

let reminderTimer = null;
function ensureReminderLoop(yannajah) {
  if (reminderTimer) return;
  reminderTimer = setInterval(async () => {
    try {
      if (!yannajah.auth?.isActive?.() || !yannajah.socket) return;
      const users = yannajah.database.raw().users;
      for (const [jid, u] of Object.entries(users)) {
        const due = (u.reminders || []).filter(r => r.at <= Date.now());
        if (!due.length) continue;
        u.reminders = u.reminders.filter(r => r.at > Date.now());
        yannajah.database.touch();
        for (const r of due) await yannajah.sendmessage(r.chat || jid, { text: `⏰ Pengingat: ${r.text}`, mentions: [jid] }).catch(() => {});
      }
    } catch { /* dicoba lagi di putaran berikutnya */ }
  }, 30000);
  reminderTimer.unref?.();
}

module.exports = [
  P({ id: 'productivity.note.add', name: 'catat', aliases: ['addnote'], description: 'Simpan catatan pribadi', usage: '<teks>',
    async run(ctx) { const n = list(ctx, 'notes'); if (n.length >= MAX_ITEMS) throw new UsageError(`Maks ${MAX_ITEMS} catatan.`); n.push({ text: ctx.requireText().slice(0, 1000), at: Date.now() }); ctx.db.touch(); await ctx.reply(`📝 Catatan #${n.length} disimpan.`); } }),
  P({ id: 'productivity.note.list', name: 'catatan', aliases: ['notes', 'listnote'], description: 'Daftar catatan kamu',
    async run(ctx) { const n = list(ctx, 'notes'); await ctx.reply(n.length ? n.map((x, i) => `${i + 1}. ${x.text}`).join('\n') : 'Belum ada catatan. Tambah: .catat <teks>'); } }),
  P({ id: 'productivity.note.del', name: 'hapuscatatan', aliases: ['delnote'], description: 'Hapus catatan: .hapuscatatan <nomor|semua>', usage: '<nomor|semua>',
    async run(ctx) { const n = list(ctx, 'notes'); if (ctx.text === 'semua') { ctx.user.notes = []; } else { const i = Number(ctx.text) - 1; if (!n[i]) throw new UsageError('Nomor catatan tidak ada.'); n.splice(i, 1); } ctx.db.touch(); await ctx.reply('🗑️ Dihapus.'); } }),
  P({ id: 'productivity.todo.add', name: 'todo', aliases: ['addtodo'], description: 'Tambah to-do', usage: '<tugas>',
    async run(ctx) { const t = list(ctx, 'todos'); if (t.length >= MAX_ITEMS) throw new UsageError(`Maks ${MAX_ITEMS} to-do.`); t.push({ text: ctx.requireText().slice(0, 300), done: false }); ctx.db.touch(); await ctx.reply(`✅ To-do #${t.length} ditambahkan.`); } }),
  P({ id: 'productivity.todo.list', name: 'todolist', aliases: ['listtodo'], description: 'Daftar to-do',
    async run(ctx) { const t = list(ctx, 'todos'); await ctx.reply(t.length ? t.map((x, i) => `${i + 1}. ${x.done ? '☑️' : '⬜'} ${x.text}`).join('\n') : 'To-do kosong. Tambah: .todo <tugas>'); } }),
  P({ id: 'productivity.todo.done', name: 'selesai', aliases: ['donetodo'], description: 'Tandai to-do selesai', usage: '<nomor>',
    async run(ctx) { const t = list(ctx, 'todos'); const x = t[Number(ctx.text) - 1]; if (!x) throw new UsageError('Nomor to-do tidak ada.'); x.done = true; ctx.db.touch(); await ctx.reply(`☑️ "${x.text}" selesai.`); } }),
  P({ id: 'productivity.todo.clear', name: 'bersihtodo', aliases: ['cleartodo'], description: 'Hapus to-do yang sudah selesai',
    async run(ctx) { const before = list(ctx, 'todos').length; ctx.user.todos = ctx.user.todos.filter(x => !x.done); ctx.db.touch(); await ctx.reply(`🧹 ${before - ctx.user.todos.length} to-do selesai dihapus.`); } }),
  P({ id: 'productivity.remind', name: 'ingatkan', aliases: ['remind', 'reminder'], description: 'Pengingat: .ingatkan 30m minum obat (s/m/jam/hari, maks 30 hari)', usage: '<durasi> <pesan>',
    async run(ctx) {
      const ms = parseDuration(ctx.args[0]);
      const text = ctx.args.slice(1).join(' ').trim();
      if (!ms || !text) throw new UsageError(`Format: ${ctx.prefix}ingatkan 30m pesan (10 detik - 30 hari)`);
      const r = list(ctx, 'reminders');
      if (r.length >= 20) throw new UsageError('Maks 20 pengingat aktif.');
      r.push({ at: Date.now() + ms, text: text.slice(0, 500), chat: ctx.m.chat });
      ctx.db.touch();
      ensureReminderLoop(ctx.yannajah);
      await ctx.reply(`⏰ Oke, aku ingatkan ${new Date(Date.now() + ms).toLocaleString('id-ID', { timeZone: ctx.config.bot.timezone })}.`);
    },
    async onMessage(ctx) { ensureReminderLoop(ctx.yannajah); return false; } }),
  P({ id: 'productivity.remind.list', name: 'listingat', aliases: ['myreminders'], description: 'Daftar pengingat aktif',
    async run(ctx) { const r = list(ctx, 'reminders'); await ctx.reply(r.length ? r.map((x, i) => `${i + 1}. ${new Date(x.at).toLocaleString('id-ID', { timeZone: ctx.config.bot.timezone })} — ${x.text}`).join('\n') : 'Tidak ada pengingat.'); } }),
  P({ id: 'productivity.remind.del', name: 'hapusingat', aliases: ['delreminder'], description: 'Hapus pengingat', usage: '<nomor>',
    async run(ctx) { const r = list(ctx, 'reminders'); const i = Number(ctx.text) - 1; if (!r[i]) throw new UsageError('Nomor tidak ada.'); r.splice(i, 1); ctx.db.touch(); await ctx.reply('🗑️ Pengingat dihapus.'); } })
];
module.exports.parseDuration = parseDuration;
