'use strict';
const { T, shuffle } = require('../../lib/text-case');

module.exports = T('shufflewords', 'Acak urutan kata', t => shuffle(t.trim().split(/\s+/)).join(' '), [{ input: 'a b c', expect: o => o.split(' ').sort().join() === 'a,b,c' }]);
