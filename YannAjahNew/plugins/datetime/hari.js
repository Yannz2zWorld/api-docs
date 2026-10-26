'use strict';
const { T, fmtDate, parseDate } = require('../../lib/datetime');

module.exports = T('hari', 'Nama hari dari tanggal', t => fmtDate(parseDate(t)), [{ input: '17-08-1945', expect: 'Jumat, 17 Agustus 1945' }], { usage: '<DD-MM-YYYY>' });
