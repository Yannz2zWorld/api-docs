'use strict';
const { T, hash } = require('../../lib/devtools');

module.exports = T('sha256', 'Hash SHA-256', hash('sha256'), [{ input: 'abc', expect: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' }]);
