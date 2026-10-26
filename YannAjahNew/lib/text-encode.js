'use strict';
// Encoding / decoding / sandi klasik.
const { textTool } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');

const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.', '@': '.--.-.', '-': '-....-', '(': '-.--.', ')': '-.--.-', ':': '---...', '=': '-...-', '+': '.-.-.' };
const UNMORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
const NATO = { a: 'Alfa', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot', g: 'Golf', h: 'Hotel', i: 'India', j: 'Juliett', k: 'Kilo', l: 'Lima', m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa', q: 'Quebec', r: 'Romeo', s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey', x: 'X-ray', y: 'Yankee', z: 'Zulu', 0: 'Zero', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine' };
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const shiftLetter = (c, n) => {
  const code = c.charCodeAt(0);
  if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + n) % 26 + 26) % 26 + 65);
  if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + n) % 26 + 26) % 26 + 97);
  return c;
};
const caesar = (t, n) => [...t].map(c => shiftLetter(c, n)).join('');
function vigenere(t, key, dir) {
  const k = key.toLowerCase().replace(/[^a-z]/g, '');
  if (!k) throw new UsageError('Kunci harus berisi huruf.');
  let j = 0;
  return [...t].map(c => (/[a-z]/i.test(c) ? shiftLetter(c, dir * (k.charCodeAt(j++ % k.length) - 97)) : c)).join('');
}
function splitKey(t, usage) {
  const i = t.indexOf('|');
  if (i < 1) throw new UsageError(`Format: ${usage}`);
  return [t.slice(0, i).trim(), t.slice(i + 1)];
}
function base32enc(buf) {
  let bits = 0, value = 0, out = '';
  for (const b of buf) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  while (out.length % 8) out += '=';
  return out;
}
function base32dec(s) {
  s = s.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  if (/[^A-Z2-7]/.test(s)) throw new UsageError('Bukan base32 yang valid.');
  let bits = 0, value = 0; const out = [];
  for (const c of s) { value = (value << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out).toString('utf8');
}
const decodeStrict = (s, enc, re) => { if (!re.test(s.replace(/\s/g, ''))) throw new UsageError(`Bukan ${enc} yang valid.`); return Buffer.from(s.replace(/\s/g, ''), enc).toString('utf8'); };

const T = (name, description, fn, tests, extra = {}) => textTool({ id: `encode.${name}`, name, category: 'text', description, fn, tests, ...extra });

module.exports = { MORSE, UNMORSE, NATO, caesar, vigenere, splitKey, base32enc, base32dec, decodeStrict, T };
