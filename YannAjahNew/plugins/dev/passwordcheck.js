'use strict';
const { T, strength } = require('../../lib/devtools');

module.exports = T('passwordcheck', 'Cek kekuatan password (tidak disimpan/dicatat)', strength, [{ input: 'aaaa1', expect: /Lemah/ }, { input: 'Tr0ub4dor&3xyzQ!', expect: /Sangat kuat|Kuat/ }], { aliases: ['cekpassword'], scope: 'private' });
