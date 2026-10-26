'use strict';
const { T } = require('../../lib/text-analyze');

module.exports = T('longestword', 'Kata terpanjang dalam teks', t => (t.match(/\p{L}+/gu) || []).reduce((a, b) => (b.length > a.length ? b : a), ''), [{ input: 'aku suka pemrograman', expect: 'pemrograman' }]);
