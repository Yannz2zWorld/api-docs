'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('lower', 'Ubah teks jadi huruf kecil', t => t.toLowerCase(), [{ input: 'HaLo', expect: 'halo' }], { aliases: ['kecil'] });
