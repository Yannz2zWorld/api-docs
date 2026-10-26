'use strict';
const { T } = require('../../lib/text-encode');

module.exports = T('charcode', 'Kode Unicode setiap karakter', t => [...t].slice(0, 200).map(c => `${c} U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} (${c.codePointAt(0)})`).join('\n'), [{ input: 'A', expect: 'A U+0041 (65)' }], { aliases: ['unicode'] });
