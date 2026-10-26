'use strict';
const { T } = require('../../lib/text-encode');

module.exports = T('rot47', 'Sandi ROT47 (ASCII 33-126)', t => [...t].map(c => { const x = c.charCodeAt(0); return x >= 33 && x <= 126 ? String.fromCharCode(33 + ((x + 14) % 94)) : c; }).join(''), [{ input: 'Hello', expect: 'w6==@' }]);
