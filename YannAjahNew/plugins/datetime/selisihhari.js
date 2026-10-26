'use strict';
const { UsageError } = require('../../library/errors');
const { T, dayDiff, parseDate } = require('../../lib/datetime');

module.exports = T('selisihhari', 'Selisih hari dua tanggal: .selisihhari 01-01-2024 31-12-2024', t => { const [a, b] = t.trim().split(/\s+/); if (!b) throw new UsageError('Butuh dua tanggal.'); const n = dayDiff(parseDate(a), parseDate(b)); return `Selisih: *${Math.abs(n)} hari* (${(Math.abs(n) / 7).toFixed(1)} minggu)`; }, [{ input: '01-01-2024 31-12-2024', expect: 'Selisih: *365 hari* (52.1 minggu)' }], { usage: '<tanggal1> <tanggal2>' });
