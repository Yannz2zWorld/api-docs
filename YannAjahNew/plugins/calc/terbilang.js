'use strict';
const { UsageError } = require('../../library/errors');
const { T, int, terbilang } = require('../../lib/calc');

module.exports = T('terbilang', 'Angka ke kata (Bahasa Indonesia)', t => { const n = int(t.trim().replace(/[.\s]/g, '')); if (n < 0 || n >= 1e15) throw new UsageError('0 .. 999 triliun.'); return n === 0 ? 'nol' : terbilang(n); }, [{ input: '1.250.075', expect: 'satu juta dua ratus lima puluh ribu tujuh puluh lima' }, { input: '115', expect: 'seratus lima belas' }]);
