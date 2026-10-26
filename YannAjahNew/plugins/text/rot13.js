'use strict';
const { T, caesar } = require('../../lib/text-encode');

module.exports = T('rot13', 'Sandi ROT13 (encode = decode)', t => caesar(t, 13), [{ input: 'Halo', expect: 'Unyb' }]);
