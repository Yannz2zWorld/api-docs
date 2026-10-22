'use strict';
// Tanggal & waktu memakai Intl (zona waktu IANA, kalender Hijriah bawaan ICU Node).
const { textTool, feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

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

module.exports = [
  feature({ id: 'datetime.time', name: 'jam', aliases: ['waktu', 'time'], category: 'datetime', description: 'Jam sekarang (WIB/WITA/WIT atau kota/zona IANA)', usage: '[zona]',
    pure: t => { const key = String(t || 'wib').trim().toLowerCase().replace(/\s+/g, ''); const tz = ZONES[key] || t.trim(); try { return `🕒 ${new Date().toLocaleString('id-ID', { timeZone: tz, dateStyle: 'full', timeStyle: 'medium' })} (${tz})`; } catch { throw new UsageError(`Zona waktu tidak dikenal. Contoh: ${Object.keys(ZONES).join(', ')}`); } },
    tests: [{ input: 'wita', expect: /Asia\/Makassar/ }, { input: 'Europe/Berlin', expect: /Europe\/Berlin/ }],
    async run(ctx) { await ctx.reply(this.pure(ctx.text)); } }),
  feature({ id: 'datetime.hijri', name: 'hijriah', aliases: ['hijri'], category: 'datetime', description: 'Tanggal Hijriah (kalender Islam, perhitungan tabular — bisa beda ±1 hari dari rukyat)', usage: '[DD-MM-YYYY]',
    pure: t => { const d = t && String(t).trim() ? parseDate(t) : new Date(); return `${fmtDate(d)}\n☪️ ${new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)}`; },
    tests: [{ input: '11-03-2024', expect: /1 Ramadan 1445/ }],
    async run(ctx) { await ctx.reply(this.pure(ctx.text)); } }),
  feature({ id: 'datetime.calendar', name: 'kalender', aliases: ['calendar'], category: 'datetime', description: 'Kalender bulan: .kalender [bulan] [tahun]', usage: '[bulan] [tahun]',
    pure: t => { const now = new Date(); const [m, y] = String(t || '').trim().split(/\s+/).map(Number); const month = m || now.getMonth() + 1, year = y || now.getFullYear(); if (month < 1 || month > 12 || year < 1 || year > 9999) throw new UsageError('Bulan 1-12, tahun 1-9999.'); return calendar(year, month); },
    tests: [{ input: '2 2024', expect: o => o.includes('Februari 2024') && o.includes(' 1  2  3') && o.includes('29') }],
    async run(ctx) { await ctx.reply(this.pure(ctx.text)); } }),
  T('hari', 'Nama hari dari tanggal', t => fmtDate(parseDate(t)), [{ input: '17-08-1945', expect: 'Jumat, 17 Agustus 1945' }], { usage: '<DD-MM-YYYY>' }),
  T('selisihhari', 'Selisih hari dua tanggal: .selisihhari 01-01-2024 31-12-2024', t => { const [a, b] = t.trim().split(/\s+/); if (!b) throw new UsageError('Butuh dua tanggal.'); const n = dayDiff(parseDate(a), parseDate(b)); return `Selisih: *${Math.abs(n)} hari* (${(Math.abs(n) / 7).toFixed(1)} minggu)`; }, [{ input: '01-01-2024 31-12-2024', expect: 'Selisih: *365 hari* (52.1 minggu)' }], { usage: '<tanggal1> <tanggal2>' }),
  T('tambahhari', 'Tanggal setelah N hari: .tambahhari 17-08-2024 100', t => { const [a, n] = t.trim().split(/\s+/); const k = parseInt(n, 10); if (!Number.isInteger(k) || Math.abs(k) > 100000) throw new UsageError('Jumlah hari tidak valid.'); const d = parseDate(a); d.setUTCDate(d.getUTCDate() + k); return fmtDate(d); }, [{ input: '17-08-2024 100', expect: 'Senin, 25 November 2024' }], { usage: '<tanggal> <hari>' }),
  T('umur', 'Hitung umur dari tanggal lahir', t => { const b = parseDate(t); const now = new Date(); let y = now.getUTCFullYear() - b.getUTCFullYear(); let mo = now.getUTCMonth() - b.getUTCMonth(); let d = now.getUTCDate() - b.getUTCDate(); if (d < 0) { mo--; d += new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).getUTCDate(); } if (mo < 0) { y--; mo += 12; } if (y < 0) throw new UsageError('Tanggal lahir di masa depan.'); const next = new Date(Date.UTC(now.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())); if (next < now) next.setUTCFullYear(next.getUTCFullYear() + 1); return `Umur: *${y} tahun ${mo} bulan ${d} hari*\nLahir hari ${HARI[b.getUTCDay()]}\nUlang tahun berikutnya: ${dayDiff(now, next) + 1} hari lagi`; }, [{ input: '01-01-2000', expect: /^Umur: \*\d+ tahun/ }], { usage: '<DD-MM-YYYY>' }),
  T('countdown', 'Hitung mundur ke tanggal', t => { const d = parseDate(t); const n = Math.ceil((d - Date.now()) / 86400000); return n > 0 ? `⏳ ${n} hari lagi menuju ${fmtDate(d)}` : n === 0 ? `🎉 Hari ini: ${fmtDate(d)}` : `${fmtDate(d)} sudah lewat ${-n} hari`; }, [{ input: '01-01-2000', expect: /sudah lewat/ }], { usage: '<DD-MM-YYYY>' }),
  T('kabisat', 'Cek tahun kabisat', t => { const y = Number(t.trim()); if (!Number.isInteger(y)) throw new UsageError('Tahun harus angka.'); return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? `✅ ${y} tahun kabisat` : `❌ ${y} bukan tahun kabisat`; }, [{ input: '2000', expect: '✅ 2000 tahun kabisat' }, { input: '1900', expect: '❌ 1900 bukan tahun kabisat' }]),
  T('mingguke', 'Nomor minggu ISO dari tanggal', t => { const d = parseDate(t); const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return `Minggu ke-${Math.ceil(((x - y0) / 86400000 + 1) / 7)} tahun ${x.getUTCFullYear()}`; }, [{ input: '01-01-2021', expect: 'Minggu ke-53 tahun 2020' }], { usage: '<DD-MM-YYYY>' })
];
module.exports.parseDate = parseDate;
