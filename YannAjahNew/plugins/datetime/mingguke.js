'use strict';
const { T, parseDate } = require('../../lib/datetime');

module.exports = T('mingguke', 'Nomor minggu ISO dari tanggal', t => { const d = parseDate(t); const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return `Minggu ke-${Math.ceil(((x - y0) / 86400000 + 1) / 7)} tahun ${x.getUTCFullYear()}`; }, [{ input: '01-01-2021', expect: 'Minggu ke-53 tahun 2020' }], { usage: '<DD-MM-YYYY>' });
