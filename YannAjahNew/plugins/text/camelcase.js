'use strict';
const { T, cap, lowerWords } = require('../../lib/text-case');

module.exports = T('camelcase', 'ubahKeCamelCase', t => lowerWords(t).map((w, i) => (i ? cap(w) : w)).join(''), [{ input: 'halo dunia indah', expect: 'haloDuniaIndah' }]);
