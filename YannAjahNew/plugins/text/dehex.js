'use strict';
const { T, decodeStrict } = require('../../lib/text-encode');

module.exports = T('dehex', 'Decode hex ke teks', t => decodeStrict(t, 'hex', /^([0-9a-fA-F]{2})+$/), [{ input: '4142', expect: 'AB' }]);
