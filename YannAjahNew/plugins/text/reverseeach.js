'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('reverseeach', 'Balik huruf di setiap kata', t => t.split(/(\s+)/).map(w => (/\s/.test(w) ? w : [...w].reverse().join(''))).join(''), [{ input: 'abc def', expect: 'cba fed' }]);
