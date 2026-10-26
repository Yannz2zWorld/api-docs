'use strict';
const { T, hash } = require('../../lib/devtools');

module.exports = T('sha1', 'Hash SHA-1', hash('sha1'), [{ input: 'abc', expect: 'a9993e364706816aba3e25717850c26c9cd0d89d' }]);
