'use strict';
const { T } = require('../../lib/text-encode');

module.exports = T('octal', 'Encode teks ke oktal', t => [...Buffer.from(t, 'utf8')].map(b => b.toString(8).padStart(3, '0')).join(' '), [{ input: 'A', expect: '101' }]);
