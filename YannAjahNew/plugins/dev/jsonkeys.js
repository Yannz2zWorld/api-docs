'use strict';
const { T, parseJson } = require('../../lib/devtools');

module.exports = T('jsonkeys', 'Daftar path key di JSON', t => { const out = []; const walk = (v, p) => { if (out.length > 200) return; if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { const q = Array.isArray(v) ? `${p}[${k}]` : p ? `${p}.${k}` : k; out.push(q); walk(x, q); } }; walk(parseJson(t), ''); return out.join('\n') || '(kosong)'; }, [{ input: '{"a":{"b":1},"c":[5]}', expect: 'a\na.b\nc\nc[0]' }]);
