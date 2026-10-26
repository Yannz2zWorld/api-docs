'use strict';
const { UsageError } = require('../../library/errors');
const { T, nums, rp } = require('../../lib/calc');

module.exports = T('patungan', 'Bagi tagihan: .patungan total orang [tip%]', t => { const p = nums(t, 2, 'total orang'); const tip = p[2] || 0; const tot = p[0] * (1 + tip / 100); if (p[1] < 1) throw new UsageError('Jumlah orang minimal 1.'); return `Total${tip ? ` (+tip ${tip}%)` : ''}: ${rp(tot)}\nPer orang (${p[1]}): *${rp(Math.ceil(tot / p[1]))}*`; }, [{ input: '300000 3', expect: o => o.endsWith('*Rp100.000*') }], { usage: '<total> <orang> [tip%]' });
