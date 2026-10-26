'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('swapcase', 'Tukar besar/kecil setiap huruf', t => [...t].map(c => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(''), [{ input: 'HaLo', expect: 'hAlO' }]);
