'use strict';
const { UsageError } = require('../../library/errors');
const { T, int } = require('../../lib/calc');

module.exports = T('factorize', 'Faktorisasi prima', t => { let n = int(t.trim()); if (n < 2 || n > 1e12) throw new UsageError('Angka 2 .. 10^12.'); const f = []; for (let d = 2; d * d <= n; d++) while (n % d === 0) { f.push(d); n /= d; } if (n > 1) f.push(n); return f.join(' × '); }, [{ input: '360', expect: '2 × 2 × 2 × 3 × 3 × 5' }], { aliases: ['faktorprima'] });
