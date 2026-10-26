'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('removepunct', 'Hapus tanda baca', t => t.replace(/[\p{P}\p{S}]/gu, ''), [{ input: 'halo, dunia!', expect: 'halo dunia' }]);
