'use strict';
const { UsageError } = require('../../library/errors');
const { HARI, T, dayDiff, parseDate } = require('../../lib/datetime');

module.exports = T('umur', 'Hitung umur dari tanggal lahir', t => { const b = parseDate(t); const now = new Date(); let y = now.getUTCFullYear() - b.getUTCFullYear(); let mo = now.getUTCMonth() - b.getUTCMonth(); let d = now.getUTCDate() - b.getUTCDate(); if (d < 0) { mo--; d += new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).getUTCDate(); } if (mo < 0) { y--; mo += 12; } if (y < 0) throw new UsageError('Tanggal lahir di masa depan.'); const next = new Date(Date.UTC(now.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())); if (next < now) next.setUTCFullYear(next.getUTCFullYear() + 1); return `Umur: *${y} tahun ${mo} bulan ${d} hari*\nLahir hari ${HARI[b.getUTCDay()]}\nUlang tahun berikutnya: ${dayDiff(now, next) + 1} hari lagi`; }, [{ input: '01-01-2000', expect: /^Umur: \*\d+ tahun/ }], { usage: '<DD-MM-YYYY>' });
