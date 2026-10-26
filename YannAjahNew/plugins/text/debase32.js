'use strict';
const { T, base32dec } = require('../../lib/text-encode');

module.exports = T('debase32', 'Decode Base32', base32dec, [{ input: 'MZXW6YTBOI======', expect: 'foobar' }]);
