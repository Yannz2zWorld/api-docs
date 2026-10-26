'use strict';
const { T } = require('../../lib/text-encode');

module.exports = T('base64url', 'Encode teks ke Base64URL', t => Buffer.from(t, 'utf8').toString('base64url'), [{ input: '??>', expect: 'Pz8-' }]);
