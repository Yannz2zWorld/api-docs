'use strict';
// Sesi game per chat (memori proses). Satu chat hanya punya satu game aktif. Habis waktu otomatis.

const { levenshtein } = require('./registry');

const sessions = new Map();   // chat -> session

const normAnswer = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function start(chat, session, { timeoutMs = 60000, onTimeout } = {}) {
  stop(chat);
  const s = { ...session, chat, startedAt: Date.now(), hints: 0 };
  s.timer = setTimeout(() => { if (sessions.get(chat) === s) { sessions.delete(chat); onTimeout?.(s); } }, timeoutMs);
  s.timer.unref?.();
  sessions.set(chat, s);
  return s;
}
function get(chat) { return sessions.get(chat) || null; }
function stop(chat) { const s = sessions.get(chat); if (s) { clearTimeout(s.timer); sessions.delete(chat); } return s || null; }

// Cocokkan jawaban: 'correct' | 'close' (beda 1-2 huruf) | null
function judge(expected, given) {
  const a = normAnswer(expected), b = normAnswer(given);
  if (!a || !b) return null;
  if (a === b) return 'correct';
  if (a.length >= 5 && levenshtein(a, b) <= (a.length >= 9 ? 2 : 1)) return 'close';
  return null;
}

// Petunjuk: buka huruf pertama lalu tiap huruf ke-N (N mengecil setiap kali .hint diminta).
function hint(answer, level) {
  let idx = 0;
  const step = Math.max(2, 5 - level);
  return [...String(answer)].map(c => {
    if (!/[a-z0-9]/i.test(c)) return c === ' ' ? ' ' : c;
    const i = idx++;
    return i % step === 0 ? c : '_';
  }).join(' ');
}

module.exports = { start, get, stop, judge, hint, normAnswer, sessions };
