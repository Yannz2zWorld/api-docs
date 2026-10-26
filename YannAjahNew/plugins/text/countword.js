'use strict';
const { T } = require('../../lib/text-analyze');

module.exports = T('countword', 'Hitung jumlah kata', t => String(t.trim().split(/\s+/).filter(Boolean).length), [{ input: 'satu dua  tiga', expect: '3' }]);
