'use strict';
const { T } = require('../../lib/text-analyze');

module.exports = T('acronym', 'Buat singkatan dari huruf awal kata', t => t.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase(), [{ input: 'kartu tanda penduduk', expect: 'KTP' }]);
