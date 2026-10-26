'use strict';
const { T, fmtDate, parseDate } = require('../../lib/datetime');

module.exports = T('countdown', 'Hitung mundur ke tanggal', t => { const d = parseDate(t); const n = Math.ceil((d - Date.now()) / 86400000); return n > 0 ? `⏳ ${n} hari lagi menuju ${fmtDate(d)}` : n === 0 ? `🎉 Hari ini: ${fmtDate(d)}` : `${fmtDate(d)} sudah lewat ${-n} hari`; }, [{ input: '01-01-2000', expect: /sudah lewat/ }], { usage: '<DD-MM-YYYY>' });
