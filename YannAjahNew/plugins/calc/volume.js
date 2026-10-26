'use strict';
const { UsageError } = require('../../library/errors');
const { fmt } = require('../../library/mathexpr');
const { T } = require('../../lib/calc');

module.exports = T('volume', 'Volume bangun ruang: .volume kubus 3 | balok 2 3 4 | bola 7 | tabung 7 10 | kerucut 7 10 | prisma luasalas tinggi | limas luasalas tinggi', t => { const [s, ...v] = t.trim().toLowerCase().split(/\s+/); const n = v.map(Number); const f = { kubus: () => n[0] ** 3, balok: () => n[0] * n[1] * n[2], bola: () => 4 / 3 * Math.PI * n[0] ** 3, tabung: () => Math.PI * n[0] ** 2 * n[1], kerucut: () => Math.PI * n[0] ** 2 * n[1] / 3, prisma: () => n[0] * n[1], limas: () => n[0] * n[1] / 3 }[s]; if (!f) throw new UsageError('Bangun: kubus, balok, bola, tabung, kerucut, prisma, limas'); const r = f(); if (!Number.isFinite(r)) throw new UsageError('Ukuran kurang lengkap.'); return `Volume ${s} = *${fmt(r)}*`; }, [{ input: 'balok 2 3 4', expect: 'Volume balok = *24*' }], { usage: '<bangun> <ukuran...>' });
