'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('leet', '1337 sp34k (leet)', t => t.replace(/[aeiolstbg]/gi, c => ({ a: '4', e: '3', i: '1', o: '0', l: '1', s: '5', t: '7', b: '8', g: '6' })[c.toLowerCase()]), [{ input: 'leet', expect: '1337' }]);
