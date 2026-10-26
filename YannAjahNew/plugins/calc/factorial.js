'use strict';
const { factorial } = require('../../library/mathexpr');
const { T, int } = require('../../lib/calc');

module.exports = T('factorial', 'Faktorial n! (maks 170, eksak sampai 25 dengan BigInt)', t => { const n = int(t.trim()); if (n <= 25 && n >= 0) { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return `${n}! = ${r}`; } return `${n}! ≈ ${factorial(n).toExponential(6)}`; }, [{ input: '20', expect: '20! = 2432902008176640000' }]);
