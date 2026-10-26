'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('sortlinesdesc', 'Urutkan baris Z-A', t => t.split('\n').sort((a, b) => b.localeCompare(a, 'id')).join('\n'), [{ input: 'a\nc\nb', expect: 'c\nb\na' }]);
