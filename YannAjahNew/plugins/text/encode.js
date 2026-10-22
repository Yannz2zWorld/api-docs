'use strict';
// Encoding / decoding / sandi klasik.
const { textTool } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

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

module.exports = [
  T('base64', 'Encode teks ke Base64', t => Buffer.from(t, 'utf8').toString('base64'), [{ input: 'halo', expect: 'aGFsbw==' }], { aliases: ['enc64'] }),
  T('debase64', 'Decode Base64 ke teks', t => decodeStrict(t, 'base64', /^[A-Za-z0-9+/]+={0,2}$/), [{ input: 'aGFsbw==', expect: 'halo' }], { aliases: ['dec64'] }),
  T('base64url', 'Encode teks ke Base64URL', t => Buffer.from(t, 'utf8').toString('base64url'), [{ input: '??>', expect: 'Pz8-' }]),
  T('debase64url', 'Decode Base64URL', t => decodeStrict(t, 'base64url', /^[A-Za-z0-9_-]+$/), [{ input: 'Pz8-', expect: '??>' }]),
  T('base32', 'Encode teks ke Base32 (RFC 4648)', t => base32enc(Buffer.from(t, 'utf8')), [{ input: 'foobar', expect: 'MZXW6YTBOI======' }]),
  T('debase32', 'Decode Base32', base32dec, [{ input: 'MZXW6YTBOI======', expect: 'foobar' }]),
  T('hex', 'Encode teks ke hex', t => Buffer.from(t, 'utf8').toString('hex'), [{ input: 'AB', expect: '4142' }], { aliases: ['tohex'] }),
  T('dehex', 'Decode hex ke teks', t => decodeStrict(t, 'hex', /^([0-9a-fA-F]{2})+$/), [{ input: '4142', expect: 'AB' }]),
  T('binary', 'Encode teks ke biner', t => [...Buffer.from(t, 'utf8')].map(b => b.toString(2).padStart(8, '0')).join(' '), [{ input: 'A', expect: '01000001' }], { aliases: ['tobinary'] }),
  T('debinary', 'Decode biner ke teks', t => { const parts = t.trim().split(/\s+/); if (!parts.every(p => /^[01]{1,8}$/.test(p))) throw new UsageError('Biner harus kelompok 0/1 maks 8 digit.'); return Buffer.from(parts.map(p => parseInt(p, 2))).toString('utf8'); }, [{ input: '01000001 01000010', expect: 'AB' }]),
  T('octal', 'Encode teks ke oktal', t => [...Buffer.from(t, 'utf8')].map(b => b.toString(8).padStart(3, '0')).join(' '), [{ input: 'A', expect: '101' }]),
  T('urlencode', 'URL-encode teks', t => encodeURIComponent(t), [{ input: 'a b&c', expect: 'a%20b%26c' }]),
  T('urldecode', 'URL-decode teks', t => { try { return decodeURIComponent(t); } catch { throw new UsageError('Format URL-encoded tidak valid.'); } }, [{ input: 'a%20b%26c', expect: 'a b&c' }]),
  T('htmlescape', 'Escape karakter HTML', t => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]), [{ input: '<b>"x"</b>', expect: '&lt;b&gt;&quot;x&quot;&lt;/b&gt;' }]),
  T('htmlunescape', 'Unescape entitas HTML', t => t.replace(/&(amp|lt|gt|quot|#39|#x([0-9a-f]+)|#(\d+));/gi, (m, n, hx, dc) => (hx ? String.fromCodePoint(parseInt(hx, 16)) : dc ? String.fromCodePoint(Number(dc)) : { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[n.toLowerCase()])), [{ input: '&lt;a&gt; &#65;&#x42;', expect: '<a> AB' }]),
  T('morse', 'Teks ke kode Morse', t => t.toLowerCase().split(' ').map(w => [...w].map(c => MORSE[c] || '').filter(Boolean).join(' ')).join(' / '), [{ input: 'sos', expect: '... --- ...' }]),
  T('demorse', 'Kode Morse ke teks', t => t.trim().split(/\s*\/\s*/).map(w => w.split(/\s+/).map(c => UNMORSE[c] ?? '?').join('')).join(' ').toUpperCase(), [{ input: '... --- ... / ..', expect: 'SOS I' }]),
  T('nato', 'Ejaan alfabet fonetik NATO', t => [...t.toLowerCase()].map(c => NATO[c] || (c === ' ' ? '·' : c)).join(' '), [{ input: 'ab1', expect: 'Alfa Bravo One' }]),
  T('rot13', 'Sandi ROT13 (encode = decode)', t => caesar(t, 13), [{ input: 'Halo', expect: 'Unyb' }]),
  T('rot47', 'Sandi ROT47 (ASCII 33-126)', t => [...t].map(c => { const x = c.charCodeAt(0); return x >= 33 && x <= 126 ? String.fromCharCode(33 + ((x + 14) % 94)) : c; }).join(''), [{ input: 'Hello', expect: 'w6==@' }]),
  T('caesar', 'Sandi Caesar: .caesar 3|teks', t => { const [n, s] = splitKey(t, 'geser|teks'); if (!/^-?\d{1,2}$/.test(n)) throw new UsageError('Geser harus angka -25..25'); return caesar(s, Number(n)); }, [{ input: '3|abc xyz', expect: 'def abc' }], { usage: '<geser>|<teks>' }),
  T('atbash', 'Sandi Atbash (A↔Z)', t => [...t].map(c => (/[a-z]/.test(c) ? String.fromCharCode(219 - c.charCodeAt(0)) : /[A-Z]/.test(c) ? String.fromCharCode(155 - c.charCodeAt(0)) : c)).join(''), [{ input: 'abc XYZ', expect: 'zyx CBA' }]),
  T('vigenere', 'Enkripsi Vigenère: .vigenere kunci|teks', t => { const [k, s] = splitKey(t, 'kunci|teks'); return vigenere(s, k, 1); }, [{ input: 'LEMON|ATTACKATDAWN', expect: 'LXFOPVEFRNHR' }], { usage: '<kunci>|<teks>' }),
  T('devigenere', 'Dekripsi Vigenère: .devigenere kunci|teks', t => { const [k, s] = splitKey(t, 'kunci|teks'); return vigenere(s, k, -1); }, [{ input: 'LEMON|LXFOPVEFRNHR', expect: 'ATTACKATDAWN' }], { usage: '<kunci>|<teks>' }),
  T('charcode', 'Kode Unicode setiap karakter', t => [...t].slice(0, 200).map(c => `${c} U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} (${c.codePointAt(0)})`).join('\n'), [{ input: 'A', expect: 'A U+0041 (65)' }], { aliases: ['unicode'] }),
  T('fromcharcode', 'Angka kode Unicode ke karakter: .fromcharcode 72 105', t => t.trim().split(/[\s,]+/).map(n => { const v = /^u\+/i.test(n) ? parseInt(n.slice(2), 16) : Number(n); if (!Number.isInteger(v) || v < 0 || v > 0x10ffff) throw new UsageError(`Kode tidak valid: ${n}`); return String.fromCodePoint(v); }).join(''), [{ input: '72 105 U+0021', expect: 'Hi!' }], { usage: '<kode...>' }),
  T('piglatin', 'Ubah ke Pig Latin (bahasa Inggris)', t => t.replace(/[a-z]+/gi, w => (/^[aeiou]/i.test(w) ? w + 'way' : w.replace(/^([^aeiou]+)(.*)$/i, '$2$1ay'))), [{ input: 'hello apple', expect: 'ellohay appleway' }])
];
