'use strict';
// Jadwal kirim pesan sekali ke satu nomor/grup (V15: .jadwalkirim / .jadwalngirimpesan / .schedulesend).
// Disimpan di database lokal (settings.scheduledSends) sehingga tetap terkirim setelah restart.
const scheduler = require('../library/scheduler');

const MAX_PENDING = 20;
const UNIT = { s: 1000, m: 60000, h: 3600000, d: 86400000, detik: 1000, menit: 60000, jam: 3600000, hari: 86400000 };

// "10m" | "2h" | "1d" | "30s" | "21:30" (hari ini/besok, zona bot) -> timestamp
function parseWhen(s, tz, now = Date.now()) {
  const rel = /^(\d{1,4})\s*(s|m|h|d|detik|menit|jam|hari)$/i.exec(String(s));
  if (rel) return now + Number(rel[1]) * UNIT[rel[2].toLowerCase()];
  const at = /^([01]?\d|2[0-3])[:.]([0-5]\d)$/.exec(String(s));
  if (!at) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now)).map(x => [x.type, x.value]));
  const nowSec = Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
  let diff = Number(at[1]) * 3600 + Number(at[2]) * 60 - nowSec;
  if (diff <= 0) diff += 86400;
  return now + diff * 1000;
}

const list = db => { const s = db.raw().settings; s.scheduledSends = s.scheduledSends || []; return s.scheduledSends; };

scheduler.register('jadwalkirim', async y => {
  const l = list(y.database);
  const due = l.filter(j => j.at <= Date.now());
  if (!due.length) return;
  y.database.raw().settings.scheduledSends = l.filter(j => j.at > Date.now()); y.database.touch();
  for (const j of due) await y.sendmessage(j.to, { text: j.text }).catch(e => y.logger?.warn?.('jadwal kirim gagal', e.message));
});

module.exports = { MAX_PENDING, parseWhen, list };
