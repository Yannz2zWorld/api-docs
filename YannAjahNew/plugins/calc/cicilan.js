'use strict';
const { UsageError } = require('../../library/errors');
const { T, nums, rp } = require('../../lib/calc');

module.exports = T('cicilan', 'Cicilan per bulan (anuitas): .cicilan pokok bunga%/tahun bulan', t => { const [P, r, n] = nums(t, 3, 'pokok bunga% bulan'); if (n <= 0 || n > 600) throw new UsageError('Tenor 1-600 bulan.'); const i = r / 100 / 12; const a = i === 0 ? P / n : P * i / (1 - Math.pow(1 + i, -n)); return `Cicilan/bulan: *${rp(a)}*\nTotal bayar: ${rp(a * n)}\nTotal bunga: ${rp(a * n - P)}`; }, [{ input: '12000000 0 12', expect: o => o.startsWith('Cicilan/bulan: *Rp1.000.000*') }, { input: '10000000 12 12', expect: o => o.startsWith('Cicilan/bulan: *Rp888.488*') }], { usage: '<pokok> <bunga%/thn> <bulan>' });
