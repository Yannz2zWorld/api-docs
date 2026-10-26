'use strict';
const { UsageError } = require('../../library/errors');
const { T } = require('../../lib/text-encode');

module.exports = T('fromcharcode', 'Angka kode Unicode ke karakter: .fromcharcode 72 105', t => t.trim().split(/[\s,]+/).map(n => { const v = /^u\+/i.test(n) ? parseInt(n.slice(2), 16) : Number(n); if (!Number.isInteger(v) || v < 0 || v > 0x10ffff) throw new UsageError(`Kode tidak valid: ${n}`); return String.fromCodePoint(v); }).join(''), [{ input: '72 105 U+0021', expect: 'Hi!' }], { usage: '<kode...>' });
