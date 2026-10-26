'use strict';
const { T, cap, lowerWords } = require('../../lib/text-case');

module.exports = T('pascalcase', 'UbahKePascalCase', t => lowerWords(t).map(cap).join(''), [{ input: 'halo dunia', expect: 'HaloDunia' }]);
