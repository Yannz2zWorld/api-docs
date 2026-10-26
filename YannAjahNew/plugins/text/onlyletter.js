'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('onlyletter', 'Ambil hurufnya saja', t => (t.match(/\p{L}+/gu) || []).join(''), [{ input: 'a1-b2 c', expect: 'abc' }]);
