'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('removenumber', 'Hapus angka dari teks', t => t.replace(/\d+/g, ''), [{ input: 'a1b22c', expect: 'abc' }]);
