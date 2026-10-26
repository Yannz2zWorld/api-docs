'use strict';
const { UsageError } = require('../../library/errors');
const { T, int } = require('../../lib/calc');

module.exports = T('basenum', 'Konversi basis bilangan: .basenum 255 10 16', t => { const [v, from, to] = t.trim().split(/\s+/); const f = int(from, 'basis asal'), tt = int(to, 'basis tujuan'); if (f < 2 || f > 36 || tt < 2 || tt > 36) throw new UsageError('Basis 2-36.'); if (!new RegExp(`^[${'0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, f)}]+$`, 'i').test(v || '')) throw new UsageError(`"${v}" bukan bilangan basis ${f}.`); return `${v} (basis ${f}) = *${BigInt(parseInt(v, f)).toString(tt).toUpperCase()}* (basis ${tt})`; }, [{ input: 'ff 16 2', expect: 'ff (basis 16) = *11111111* (basis 2)' }], { usage: '<nilai> <basis asal> <basis tujuan>' });
