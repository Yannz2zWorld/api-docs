'use strict';
const { MORSE, T } = require('../../lib/text-encode');

module.exports = T('morse', 'Teks ke kode Morse', t => t.toLowerCase().split(' ').map(w => [...w].map(c => MORSE[c] || '').filter(Boolean).join(' ')).join(' / '), [{ input: 'sos', expect: '... --- ...' }]);
