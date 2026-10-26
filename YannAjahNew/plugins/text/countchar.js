'use strict';
const { T } = require('../../lib/text-analyze');

module.exports = T('countchar', 'Hitung jumlah karakter', t => String([...t].length), [{ input: 'ab😀', expect: '3' }]);
