'use strict';
const { T, lowerWords } = require('../../lib/text-case');

module.exports = T('constantcase', 'UBAH_KE_CONSTANT_CASE', t => lowerWords(t).join('_').toUpperCase(), [{ input: 'max retry count', expect: 'MAX_RETRY_COUNT' }]);
