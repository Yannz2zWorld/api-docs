'use strict';
const { T } = require('../../lib/text-encode');

module.exports = T('urlencode', 'URL-encode teks', t => encodeURIComponent(t), [{ input: 'a b&c', expect: 'a%20b%26c' }]);
