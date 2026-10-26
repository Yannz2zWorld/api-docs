'use strict';
const { T, hash } = require('../../lib/devtools');

module.exports = T('sha512', 'Hash SHA-512', hash('sha512'), [{ input: 'abc', expect: /^ddaf35a193617aba/ }]);
