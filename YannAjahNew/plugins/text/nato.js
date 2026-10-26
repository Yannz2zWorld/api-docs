'use strict';
const { NATO, T } = require('../../lib/text-encode');

module.exports = T('nato', 'Ejaan alfabet fonetik NATO', t => [...t.toLowerCase()].map(c => NATO[c] || (c === ' ' ? '·' : c)).join(' '), [{ input: 'ab1', expect: 'Alfa Bravo One' }]);
