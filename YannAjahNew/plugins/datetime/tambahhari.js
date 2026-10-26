'use strict';
const { UsageError } = require('../../library/errors');
const { T, fmtDate, parseDate } = require('../../lib/datetime');

module.exports = T('tambahhari', 'Tanggal setelah N hari: .tambahhari 17-08-2024 100', t => { const [a, n] = t.trim().split(/\s+/); const k = parseInt(n, 10); if (!Number.isInteger(k) || Math.abs(k) > 100000) throw new UsageError('Jumlah hari tidak valid.'); const d = parseDate(a); d.setUTCDate(d.getUTCDate() + k); return fmtDate(d); }, [{ input: '17-08-2024 100', expect: 'Senin, 25 November 2024' }], { usage: '<tanggal> <hari>' });
