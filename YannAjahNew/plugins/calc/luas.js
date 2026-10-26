'use strict';
const { UsageError } = require('../../library/errors');
const { fmt } = require('../../library/mathexpr');
const { T } = require('../../lib/calc');

module.exports = T('luas', 'Luas bangun: .luas persegi 4 | persegipanjang 3 5 | segitiga 3 4 | lingkaran 7 | trapesium 3 5 4', t => { const [s, ...v] = t.trim().toLowerCase().split(/\s+/); const n = v.map(Number); const f = { persegi: () => n[0] ** 2, persegipanjang: () => n[0] * n[1], segitiga: () => n[0] * n[1] / 2, lingkaran: () => Math.PI * n[0] ** 2, trapesium: () => (n[0] + n[1]) / 2 * n[2], jajargenjang: () => n[0] * n[1], belahketupat: () => n[0] * n[1] / 2 }[s]; if (!f) throw new UsageError('Bangun: persegi, persegipanjang, segitiga, lingkaran, trapesium, jajargenjang, belahketupat'); const r = f(); if (!Number.isFinite(r)) throw new UsageError('Ukuran kurang lengkap.'); return `Luas ${s} = *${fmt(r)}*`; }, [{ input: 'lingkaran 7', expect: /^Luas lingkaran = \*153,938/ }, { input: 'trapesium 3 5 4', expect: 'Luas trapesium = *16*' }], { usage: '<bangun> <ukuran...>' });
