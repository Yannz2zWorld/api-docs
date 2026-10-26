'use strict';
const { T, fromRoman } = require('../../lib/calc');

module.exports = T('deroman', 'Romawi ke angka', t => String(fromRoman(t)), [{ input: 'MCMXCIV', expect: '1994' }]);
