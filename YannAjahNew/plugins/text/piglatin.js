'use strict';
const { T } = require('../../lib/text-encode');

module.exports = T('piglatin', 'Ubah ke Pig Latin (bahasa Inggris)', t => t.replace(/[a-z]+/gi, w => (/^[aeiou]/i.test(w) ? w + 'way' : w.replace(/^([^aeiou]+)(.*)$/i, '$2$1ay'))), [{ input: 'hello apple', expect: 'ellohay appleway' }]);
