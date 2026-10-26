'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('slug', 'Buat slug URL dari teks', t => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''), [{ input: 'Café Enak & Murah!', expect: 'cafe-enak-murah' }]);
