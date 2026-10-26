'use strict';
const { T, int, toRoman } = require('../../lib/calc');

module.exports = T('roman', 'Angka ke Romawi', t => toRoman(int(t.trim())), [{ input: '2024', expect: 'MMXXIV' }], { aliases: ['romawi'] });
