'use strict';
const { T, splitKey, vigenere } = require('../../lib/text-encode');

module.exports = T('devigenere', 'Dekripsi Vigenère: .devigenere kunci|teks', t => { const [k, s] = splitKey(t, 'kunci|teks'); return vigenere(s, k, -1); }, [{ input: 'LEMON|LXFOPVEFRNHR', expect: 'ATTACKATDAWN' }], { usage: '<kunci>|<teks>' });
