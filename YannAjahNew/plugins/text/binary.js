'use strict';
const { T } = require('../../lib/text-encode');

module.exports = T('binary', 'Encode teks ke biner', t => [...Buffer.from(t, 'utf8')].map(b => b.toString(2).padStart(8, '0')).join(' '), [{ input: 'A', expect: '01000001' }], { aliases: ['tobinary'] });
