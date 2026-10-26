'use strict';
const { T, nums, rp } = require('../../lib/calc');

module.exports = T('bungamajemuk', 'Bunga majemuk: .bungamajemuk pokok bunga%/tahun tahun', t => { const [P, r, y] = nums(t, 3, 'pokok bunga% tahun'); const A = P * Math.pow(1 + r / 100, y); return `Nilai akhir: *${rp(A)}*\nBunga: ${rp(A - P)}`; }, [{ input: '1000000 10 2', expect: o => o.startsWith('Nilai akhir: *Rp1.210.000*') }], { usage: '<pokok> <bunga%> <tahun>' });
