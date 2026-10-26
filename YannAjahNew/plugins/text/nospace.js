'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('nospace', 'Hapus semua spasi', t => t.replace(/\s+/g, ''), [{ input: 'a b  c', expect: 'abc' }]);
