'use strict';
const crypto = require('crypto');
const { UsageError } = require('../../library/errors');
const { T } = require('../../lib/devtools');

module.exports = T('hmac', 'HMAC-SHA256: .hmac kunci|pesan', t => { const i = t.indexOf('|'); if (i < 1) throw new UsageError('Format: kunci|pesan'); return crypto.createHmac('sha256', t.slice(0, i)).update(t.slice(i + 1)).digest('hex'); }, [{ input: 'key|The quick brown fox jumps over the lazy dog', expect: 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8' }], { usage: '<kunci>|<pesan>' });
