'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('removeemoji', 'Hapus emoji dari teks', t => t.replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}‍️]/gu, '').replace(/ {2,}/g, ' ').trim(), [{ input: 'halo 😀 dunia 🌍', expect: 'halo dunia' }]);
