'use strict';
const { T, splitKey, vigenere } = require('../../lib/text-encode');

module.exports = T('vigenere', 'Enkripsi Vigenère: .vigenere kunci|teks', t => { const [k, s] = splitKey(t, 'kunci|teks'); return vigenere(s, k, 1); }, [{ input: 'LEMON|ATTACKATDAWN', expect: 'LXFOPVEFRNHR' }], { usage: '<kunci>|<teks>' });
