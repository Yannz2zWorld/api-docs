'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('alay', 'Ubah teks jadi gaya alay', t => t.replace(/a/gi, '4').replace(/e/gi, '3').replace(/i/gi, '1').replace(/o/gi, '0').replace(/s/gi, '5').replace(/g/gi, '9'), [{ input: 'aku sayang', expect: '4ku 54y4n9' }]);
