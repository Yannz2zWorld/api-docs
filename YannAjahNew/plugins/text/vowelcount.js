'use strict';
const { T } = require('../../lib/text-analyze');

module.exports = T('vowelcount', 'Hitung huruf vokal & konsonan', t => { const v = (t.match(/[aiueo]/gi) || []).length; const c = (t.match(/[b-df-hj-np-tv-z]/gi) || []).length; return `Vokal: ${v}\nKonsonan: ${c}`; }, [{ input: 'halo', expect: 'Vokal: 2\nKonsonan: 2' }]);
