'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('numberlines', 'Beri nomor setiap baris', t => t.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n'), [{ input: 'a\nb', expect: '1. a\n2. b' }]);
