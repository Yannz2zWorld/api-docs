'use strict';
const { UsageError } = require('../../library/errors');
const { T, nums } = require('../../lib/calc');

module.exports = T('random', 'Angka acak: .random min max', t => { const [a, b] = nums(t, 2, 'min max'); const lo = Math.ceil(Math.min(a, b)), hi = Math.floor(Math.max(a, b)); if (hi - lo > 1e12) throw new UsageError('Rentang terlalu besar.'); return `🎲 ${lo + require('crypto').randomInt(0, hi - lo + 1)}`; }, [{ input: '5 5', expect: '🎲 5' }], { aliases: ['acakangka'], usage: '<min> <max>' });
