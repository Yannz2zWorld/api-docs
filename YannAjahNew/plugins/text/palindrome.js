'use strict';
const { T, norm } = require('../../lib/text-analyze');

module.exports = T('palindrome', 'Cek apakah teks palindrom', t => { const s = norm(t); return s && s === [...s].reverse().join('') ? `✅ "${t}" adalah palindrom` : `❌ "${t}" bukan palindrom`; }, [{ input: 'Kasur ini rusak', expect: o => o.startsWith('✅') }, { input: 'halo', expect: o => o.startsWith('❌') }]);
