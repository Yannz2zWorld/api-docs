'use strict';
const { T, lowerWords } = require('../../lib/text-case');

module.exports = T('kebabcase', 'ubah-ke-kebab-case', t => lowerWords(t).join('-'), [{ input: 'haloDunia indah', expect: 'halo-dunia-indah' }]);
