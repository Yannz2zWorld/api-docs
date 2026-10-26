'use strict';
const { T, gcd, int } = require('../../lib/calc');

module.exports = T('gcd', 'FPB dari beberapa bilangan', t => `FPB = *${t.trim().split(/[\s,;]+/).map(x => int(x)).reduce(gcd)}*`, [{ input: '12 18 24', expect: 'FPB = *6*' }], { aliases: ['fpb'], usage: '<a> <b> ...' });
