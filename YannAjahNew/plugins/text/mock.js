'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('mock', 'tEkS gAyA mEnGeJeK (selang-seling)', t => { let i = 0; return [...t].map(c => (/\p{L}/u.test(c) ? (i++ % 2 ? c.toUpperCase() : c.toLowerCase()) : c)).join(''); }, [{ input: 'halo dunia', expect: 'hAlO dUnIa' }]);
