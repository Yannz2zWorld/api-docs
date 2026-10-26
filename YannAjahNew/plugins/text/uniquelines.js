'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('uniquelines', 'Hapus baris duplikat', t => [...new Set(t.split('\n'))].join('\n'), [{ input: 'a\nb\na', expect: 'a\nb' }]);
