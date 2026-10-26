'use strict';
const { T, nums, rp } = require('../../lib/calc');

module.exports = T('diskon', 'Harga setelah diskon: .diskon 250000 20', t => { const [h, d] = nums(t, 2, 'harga diskon%'); return `Harga awal: ${rp(h)}\nDiskon ${d}%: -${rp(h * d / 100)}\nBayar: *${rp(h * (1 - d / 100))}*`; }, [{ input: '250000 20', expect: o => o.includes('Bayar: *Rp200.000*') }], { usage: '<harga> <diskon%>' });
