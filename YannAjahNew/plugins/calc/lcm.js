'use strict';
const { T, gcd, int } = require('../../lib/calc');

module.exports = T('lcm', 'KPK dari beberapa bilangan', t => `KPK = *${t.trim().split(/[\s,;]+/).map(x => int(x)).reduce((a, b) => Math.abs(a * b) / gcd(a, b))}*`, [{ input: '4 6', expect: 'KPK = *12*' }], { aliases: ['kpk'], usage: '<a> <b> ...' });
