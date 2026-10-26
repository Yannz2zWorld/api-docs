'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('sortlines', 'Urutkan baris A-Z', t => t.split('\n').sort((a, b) => a.localeCompare(b, 'id')).join('\n'), [{ input: 'c\na\nb', expect: 'a\nb\nc' }]);
