'use strict';
const { fmt } = require('../../library/mathexpr');
const { T, nums } = require('../../lib/calc');

module.exports = T('pythagoras', 'Sisi miring segitiga siku-siku: .pythagoras a b', t => { const [a, b] = nums(t, 2, 'a b'); return `c = *${fmt(Math.hypot(a, b))}*`; }, [{ input: '3 4', expect: 'c = *5*' }], { usage: '<a> <b>' });
