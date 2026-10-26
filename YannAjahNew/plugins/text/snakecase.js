'use strict';
const { T, lowerWords } = require('../../lib/text-case');

module.exports = T('snakecase', 'ubah_ke_snake_case', t => lowerWords(t).join('_'), [{ input: 'Halo Dunia Indah', expect: 'halo_dunia_indah' }]);
