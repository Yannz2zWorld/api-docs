'use strict';
const { T, hash } = require('../../lib/devtools');

module.exports = T('md5', 'Hash MD5 (bukan untuk password!)', hash('md5'), [{ input: 'abc', expect: '900150983cd24fb0d6963f7d28e17f72' }]);
