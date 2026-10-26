'use strict';
const { T, decodeStrict } = require('../../lib/text-encode');

module.exports = T('debase64url', 'Decode Base64URL', t => decodeStrict(t, 'base64url', /^[A-Za-z0-9_-]+$/), [{ input: 'Pz8-', expect: '??>' }]);
