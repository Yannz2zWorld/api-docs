'use strict';
const { UsageError } = require('../../library/errors');
const { T, norm } = require('../../lib/text-analyze');

module.exports = T('anagram', 'Cek anagram: .anagram kata1|kata2', t => { const [a, b] = t.split('|'); if (!b) throw new UsageError('Format: kata1|kata2'); const k = s => [...norm(s)].sort().join(''); return k(a) === k(b) ? `✅ Anagram` : `❌ Bukan anagram`; }, [{ input: 'listen|silent', expect: '✅ Anagram' }, { input: 'abc|abd', expect: '❌ Bukan anagram' }], { usage: '<kata1>|<kata2>' });
