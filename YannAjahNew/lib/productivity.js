'use strict';
// Produktivitas pribadi per user: catatan, to-do, pengingat (disimpan di database lokal bot).
// Pengingat dicek tiap 30 detik oleh hook; tetap tersimpan setelah restart.
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');

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

module.exports = { P, MAX_ITEMS, list, parseDuration, ensureReminderLoop };
