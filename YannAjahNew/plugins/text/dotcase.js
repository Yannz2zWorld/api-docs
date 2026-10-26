'use strict';
const { T, lowerWords } = require('../../lib/text-case');

module.exports = T('dotcase', 'ubah.ke.dot.case', t => lowerWords(t).join('.'), [{ input: 'Halo Dunia', expect: 'halo.dunia' }]);
