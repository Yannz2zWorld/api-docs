'use strict';
const { UsageError } = require('../../library/errors');
const { T, int, isPrime } = require('../../lib/calc');

module.exports = T('isprime', 'Cek bilangan prima', t => { const n = int(t.trim()); if (n > 1e12) throw new UsageError('Maks 10^12.'); return isPrime(n) ? `✅ ${n} adalah bilangan prima` : `❌ ${n} bukan bilangan prima`; }, [{ input: '97', expect: '✅ 97 adalah bilangan prima' }, { input: '91', expect: '❌ 91 bukan bilangan prima' }], { aliases: ['prima'] });
