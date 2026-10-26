'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('titlecase', 'Setiap Kata Diawali Huruf Besar', t => t.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()), [{ input: 'halo dunia indah', expect: 'Halo Dunia Indah' }]);
