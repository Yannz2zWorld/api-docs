'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('sentencecase', 'Huruf besar di awal setiap kalimat', t => t.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()), [{ input: 'halo. apa kabar? baik', expect: 'Halo. Apa kabar? Baik' }]);
