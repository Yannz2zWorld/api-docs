'use strict';
const { UsageError } = require('../../library/errors');
const { fmt } = require('../../library/mathexpr');
const { T, nums } = require('../../lib/calc');

module.exports = T('kuadrat', 'Akar persamaan kuadrat ax²+bx+c=0: .kuadrat a b c', t => { const [a, b, c] = nums(t, 3, 'a b c'); if (a === 0) throw new UsageError('a tidak boleh 0.'); const D = b * b - 4 * a * c; if (D < 0) { const re = -b / (2 * a), im = Math.sqrt(-D) / (2 * a); return `D = ${D}\nx = ${fmt(re)} ± ${fmt(Math.abs(im))}i`; } const x1 = (-b + Math.sqrt(D)) / (2 * a), x2 = (-b - Math.sqrt(D)) / (2 * a); return `D = ${D}\nx1 = ${fmt(x1)}\nx2 = ${fmt(x2)}`; }, [{ input: '1 -3 2', expect: 'D = 1\nx1 = 2\nx2 = 1' }], { usage: '<a> <b> <c>' });
