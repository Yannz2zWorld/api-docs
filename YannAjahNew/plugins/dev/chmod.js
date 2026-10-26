'use strict';
const { UsageError } = require('../../library/errors');
const { T } = require('../../lib/devtools');

module.exports = T('chmod', 'Konversi izin chmod angka ↔ simbol', t => { const s = t.trim(); if (/^[0-7]{3}$/.test(s)) return `${s} = ${[...s].map(d => ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'][d]).join('')}`; if (/^[rwx-]{9}$/.test(s)) return `${s} = ${[0, 3, 6].map(i => (s[i] === 'r' ? 4 : 0) + (s[i + 1] === 'w' ? 2 : 0) + (s[i + 2] === 'x' ? 1 : 0)).join('')}`; throw new UsageError('Format: 755 atau rwxr-xr-x'); }, [{ input: '754', expect: '754 = rwxr-xr--' }, { input: 'rw-r--r--', expect: 'rw-r--r-- = 644' }]);
