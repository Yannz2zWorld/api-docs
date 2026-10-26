'use strict';
const { T, shuffle } = require('../../lib/text-case');

module.exports = T('shufflelines', 'Acak urutan baris', t => shuffle(t.split('\n')).join('\n'), [{ input: 'a\nb\nc', expect: o => o.split('\n').sort().join() === 'a,b,c' }]);
