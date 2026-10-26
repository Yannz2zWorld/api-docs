'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('onlynumber', 'Ambil angkanya saja', t => (t.match(/\d+/g) || []).join(''), [{ input: 'tel: 0812-34', expect: '081234' }]);
