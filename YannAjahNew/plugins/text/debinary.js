'use strict';
const { UsageError } = require('../../library/errors');
const { T } = require('../../lib/text-encode');

module.exports = T('debinary', 'Decode biner ke teks', t => { const parts = t.trim().split(/\s+/); if (!parts.every(p => /^[01]{1,8}$/.test(p))) throw new UsageError('Biner harus kelompok 0/1 maks 8 digit.'); return Buffer.from(parts.map(p => parseInt(p, 2))).toString('utf8'); }, [{ input: '01000001 01000010', expect: 'AB' }]);
