'use strict';
const { T } = require('../../lib/text-analyze');

module.exports = T('readtime', 'Perkiraan waktu baca (200 kata/menit)', t => { const n = t.trim().split(/\s+/).filter(Boolean).length; const s = Math.ceil(n / 200 * 60); return `${n} kata ≈ ${s < 60 ? `${s} detik` : `${Math.floor(s / 60)} menit ${s % 60} detik`}`; }, [{ input: Array(400).fill('kata').join(' '), expect: '400 kata ≈ 2 menit 0 detik' }]);
