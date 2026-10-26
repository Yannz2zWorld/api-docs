'use strict';
const { T, int } = require('../../lib/calc');

module.exports = T('fibonacci', 'Deret Fibonacci n suku pertama (maks 90)', t => { const n = Math.min(int(t.trim()), 90); const a = [0, 1]; while (a.length < n) a.push(a[a.length - 1] + a[a.length - 2]); return a.slice(0, n).join(', '); }, [{ input: '8', expect: '0, 1, 1, 2, 3, 5, 8, 13' }]);
