'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('trimspace', 'Rapikan spasi berlebih', t => t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim(), [{ input: '  a   b  \n\n\n\n c ', expect: 'a b\n\nc' }]);
