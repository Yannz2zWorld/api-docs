'use strict';
const { UsageError } = require('../../library/errors');
const { T, caesar, splitKey } = require('../../lib/text-encode');

module.exports = T('caesar', 'Sandi Caesar: .caesar 3|teks', t => { const [n, s] = splitKey(t, 'geser|teks'); if (!/^-?\d{1,2}$/.test(n)) throw new UsageError('Geser harus angka -25..25'); return caesar(s, Number(n)); }, [{ input: '3|abc xyz', expect: 'def abc' }], { usage: '<geser>|<teks>' });
