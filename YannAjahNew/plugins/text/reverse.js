'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('reverse', 'Balik urutan huruf', t => [...t].reverse().join(''), [{ input: 'abc def', expect: 'fed cba' }], { aliases: ['balik'] });
