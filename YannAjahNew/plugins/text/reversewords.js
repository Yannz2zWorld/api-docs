'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('reversewords', 'Balik urutan kata', t => t.trim().split(/\s+/).reverse().join(' '), [{ input: 'satu dua tiga', expect: 'tiga dua satu' }]);
