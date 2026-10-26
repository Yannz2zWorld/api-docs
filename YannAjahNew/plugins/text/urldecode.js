'use strict';
const { UsageError } = require('../../library/errors');
const { T } = require('../../lib/text-encode');

module.exports = T('urldecode', 'URL-decode teks', t => { try { return decodeURIComponent(t); } catch { throw new UsageError('Format URL-encoded tidak valid.'); } }, [{ input: 'a%20b%26c', expect: 'a b&c' }]);
