'use strict';
// Tanggal & waktu memakai Intl (zona waktu IANA, kalender Hijriah bawaan ICU Node).
const { textTool, feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');

const ZONES = { wib: 'Asia/Jakarta', wita: 'Asia/Makassar', wit: 'Asia/Jayapura', jakarta: 'Asia/Jakarta', tokyo: 'Asia/Tokyo', seoul: 'Asia/Seoul', singapore: 'Asia/Singapore', mekah: 'Asia/Riyadh', makkah: 'Asia/Riyadh', dubai: 'Asia/Dubai', london: 'Europe/London', paris: 'Europe/Paris', newyork: 'America/New_York', la: 'America/Los_Angeles', sydney: 'Australia/Sydney', utc: 'UTC' };
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function parseDate(s) {
  s = String(s || '').trim();
  let m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) { const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])); if (d.getUTCDate() !== +m[1] || d.getUTCMonth() !== +m[2] - 1) throw new UsageError(`Tanggal tidak valid: ${s}`); return d; }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) { const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); if (d.getUTCDate() !== +m[3]) throw new UsageError(`Tanggal tidak valid: ${s}`); return d; }
  throw new UsageError(`Format tanggal: DD-MM-YYYY atau YYYY-MM-DD (bukan "${s}")`);
}
const fmtDate = d => `${HARI[d.getUTCDay()]}, ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`;
const dayDiff = (a, b) => Math.round((b - a) / 86400000);
const T = (name, description, fn, tests, extra = {}) => textTool({ id: `datetime.${name}`, name, category: 'datetime', description, fn, tests, ...extra });

function calendar(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const title = first.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const rows = ['Mg Sn Sl Rb Km Jm Sb'];
  let line = '   '.repeat(first.getUTCDay());
  for (let d = 1; d <= days; d++) { line += String(d).padStart(2, ' ') + ' '; if ((first.getUTCDay() + d) % 7 === 0) { rows.push(line.trimEnd()); line = ''; } }
  if (line.trim()) rows.push(line.trimEnd());
  return `🗓️ ${title}\n\`\`\`\n${rows.join('\n')}\n\`\`\``;
}

module.exports = { ZONES, HARI, parseDate, fmtDate, dayDiff, T, calendar };
