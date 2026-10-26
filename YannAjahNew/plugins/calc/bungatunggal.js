'use strict';
const { T, nums, rp } = require('../../lib/calc');

module.exports = T('bungatunggal', 'Bunga tunggal: .bungatunggal pokok bunga%/tahun tahun', t => { const [P, r, y] = nums(t, 3, 'pokok bunga% tahun'); return `Bunga: ${rp(P * r / 100 * y)}\nTotal: *${rp(P * (1 + r / 100 * y))}*`; }, [{ input: '1000000 10 2', expect: o => o.endsWith('*Rp1.200.000*') }], { usage: '<pokok> <bunga%> <tahun>' });
