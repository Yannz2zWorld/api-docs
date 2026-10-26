'use strict';
const { UsageError } = require('../../library/errors');
const { fmt } = require('../../library/mathexpr');
const { T } = require('../../lib/calc');

module.exports = T('average', 'Rata-rata nilai (misal nilai rapor)', t => { const a = t.trim().split(/[\s,;]+/).map(Number); if (!a.length || a.some(x => !Number.isFinite(x))) throw new UsageError('Masukkan daftar angka.'); return `Rata-rata dari ${a.length} nilai = *${fmt(a.reduce((x, y) => x + y, 0) / a.length)}*`; }, [{ input: '80 90 100', expect: 'Rata-rata dari 3 nilai = *90*' }], { aliases: ['ratarata'] });
