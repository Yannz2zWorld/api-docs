'use strict';
const { T } = require('../../lib/text-encode');

module.exports = T('atbash', 'Sandi Atbash (A↔Z)', t => [...t].map(c => (/[a-z]/.test(c) ? String.fromCharCode(219 - c.charCodeAt(0)) : /[A-Z]/.test(c) ? String.fromCharCode(155 - c.charCodeAt(0)) : c)).join(''), [{ input: 'abc XYZ', expect: 'zyx CBA' }]);
