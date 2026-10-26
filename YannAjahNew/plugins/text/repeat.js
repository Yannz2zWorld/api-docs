'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('repeat', 'Ulangi teks: .repeat 3|teks', t => { const m = /^(\d{1,3})\s*\|\s*([\s\S]+)$/.exec(t); if (!m) return 'Format: jumlah|teks (maks 100)'; return Array(Math.min(Number(m[1]), 100)).fill(m[2]).join('\n'); }, [{ input: '2|hi', expect: 'hi\nhi' }], { usage: '<jumlah>|<teks>' });
