'use strict';
const { T, base32enc } = require('../../lib/text-encode');

module.exports = T('base32', 'Encode teks ke Base32 (RFC 4648)', t => base32enc(Buffer.from(t, 'utf8')), [{ input: 'foobar', expect: 'MZXW6YTBOI======' }]);
