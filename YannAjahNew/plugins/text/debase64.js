'use strict';
const { T, decodeStrict } = require('../../lib/text-encode');

module.exports = T('debase64', 'Decode Base64 ke teks', t => decodeStrict(t, 'base64', /^[A-Za-z0-9+/]+={0,2}$/), [{ input: 'aGFsbw==', expect: 'halo' }], { aliases: ['dec64'] });
