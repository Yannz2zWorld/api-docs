'use strict';
// Aktivitas grup V15: pencatat chat (total chat, sider, auto level), streak harian berpasangan,
// ulang tahun member, absen harian otomatis (poll), jadwal pesan berulang.
const crypto = require('crypto');
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const scheduler = require('../library/scheduler');
const { targetJid, mention, toPn } = require('../library/targets');

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

module.exports = { DAY, G, A, act, need, MONTHS, members, botJid, pairKey, streakState };
