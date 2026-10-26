'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('upper', 'Ubah teks jadi HURUF BESAR', t => t.toUpperCase(), [{ input: 'halo Dunia', expect: 'HALO DUNIA' }], { aliases: ['kapital'] });
