'use strict';
const { fmt } = require('../../library/mathexpr');
const { T, nums } = require('../../lib/calc');

module.exports = T('persen', 'Hitung persen: .persen 15 200 (15% dari 200)', t => { const [p, n] = nums(t, 2, 'persen nilai'); return `${p}% dari ${fmt(n)} = *${fmt(p / 100 * n)}*`; }, [{ input: '15 200', expect: '15% dari 200 = *30*' }], { usage: '<persen> <nilai>' });
