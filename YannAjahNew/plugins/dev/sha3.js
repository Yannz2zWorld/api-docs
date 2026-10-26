'use strict';
const { T, hash } = require('../../lib/devtools');

module.exports = T('sha3', 'Hash SHA3-256', hash('sha3-256'), [{ input: 'abc', expect: '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532' }]);
