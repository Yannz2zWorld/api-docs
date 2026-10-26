'use strict';
const { T, UNMORSE } = require('../../lib/text-encode');

module.exports = T('demorse', 'Kode Morse ke teks', t => t.trim().split(/\s*\/\s*/).map(w => w.split(/\s+/).map(c => UNMORSE[c] ?? '?').join('')).join(' ').toUpperCase(), [{ input: '... --- ... / ..', expect: 'SOS I' }]);
