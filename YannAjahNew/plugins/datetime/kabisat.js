'use strict';
const { UsageError } = require('../../library/errors');
const { T } = require('../../lib/datetime');

module.exports = T('kabisat', 'Cek tahun kabisat', t => { const y = Number(t.trim()); if (!Number.isInteger(y)) throw new UsageError('Tahun harus angka.'); return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? `✅ ${y} tahun kabisat` : `❌ ${y} bukan tahun kabisat`; }, [{ input: '2000', expect: '✅ 2000 tahun kabisat' }, { input: '1900', expect: '❌ 1900 bukan tahun kabisat' }]);
