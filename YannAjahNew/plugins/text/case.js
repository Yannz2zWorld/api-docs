'use strict';
// Transformasi teks (huruf besar/kecil, gaya penulisan, urutan, pembersihan).
const { textTool } = require('../../library/plugin-kit');

const words = t => t.trim().split(/[\s_\-.]+|(?<=[a-z0-9])(?=[A-Z])/).filter(Boolean);
const lowerWords = t => words(t).map(w => w.toLowerCase());
const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
const shuffle = a => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = require('crypto').randomInt(0, i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };

const T = (name, description, fn, tests, extra = {}) => textTool({ id: `text.${name}`, name, category: 'text', description, fn, tests, ...extra });

module.exports = [
  T('upper', 'Ubah teks jadi HURUF BESAR', t => t.toUpperCase(), [{ input: 'halo Dunia', expect: 'HALO DUNIA' }], { aliases: ['kapital'] }),
  T('lower', 'Ubah teks jadi huruf kecil', t => t.toLowerCase(), [{ input: 'HaLo', expect: 'halo' }], { aliases: ['kecil'] }),
  T('titlecase', 'Setiap Kata Diawali Huruf Besar', t => t.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()), [{ input: 'halo dunia indah', expect: 'Halo Dunia Indah' }]),
  T('sentencecase', 'Huruf besar di awal setiap kalimat', t => t.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()), [{ input: 'halo. apa kabar? baik', expect: 'Halo. Apa kabar? Baik' }]),
  T('swapcase', 'Tukar besar/kecil setiap huruf', t => [...t].map(c => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(''), [{ input: 'HaLo', expect: 'hAlO' }]),
  T('mock', 'tEkS gAyA mEnGeJeK (selang-seling)', t => { let i = 0; return [...t].map(c => (/\p{L}/u.test(c) ? (i++ % 2 ? c.toUpperCase() : c.toLowerCase()) : c)).join(''); }, [{ input: 'halo dunia', expect: 'hAlO dUnIa' }]),
  T('camelcase', 'ubahKeCamelCase', t => lowerWords(t).map((w, i) => (i ? cap(w) : w)).join(''), [{ input: 'halo dunia indah', expect: 'haloDuniaIndah' }]),
  T('pascalcase', 'UbahKePascalCase', t => lowerWords(t).map(cap).join(''), [{ input: 'halo dunia', expect: 'HaloDunia' }]),
  T('snakecase', 'ubah_ke_snake_case', t => lowerWords(t).join('_'), [{ input: 'Halo Dunia Indah', expect: 'halo_dunia_indah' }]),
  T('kebabcase', 'ubah-ke-kebab-case', t => lowerWords(t).join('-'), [{ input: 'haloDunia indah', expect: 'halo-dunia-indah' }]),
  T('constantcase', 'UBAH_KE_CONSTANT_CASE', t => lowerWords(t).join('_').toUpperCase(), [{ input: 'max retry count', expect: 'MAX_RETRY_COUNT' }]),
  T('dotcase', 'ubah.ke.dot.case', t => lowerWords(t).join('.'), [{ input: 'Halo Dunia', expect: 'halo.dunia' }]),
  T('slug', 'Buat slug URL dari teks', t => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''), [{ input: 'Café Enak & Murah!', expect: 'cafe-enak-murah' }]),
  T('reverse', 'Balik urutan huruf', t => [...t].reverse().join(''), [{ input: 'abc def', expect: 'fed cba' }], { aliases: ['balik'] }),
  T('reversewords', 'Balik urutan kata', t => t.trim().split(/\s+/).reverse().join(' '), [{ input: 'satu dua tiga', expect: 'tiga dua satu' }]),
  T('reverseeach', 'Balik huruf di setiap kata', t => t.split(/(\s+)/).map(w => (/\s/.test(w) ? w : [...w].reverse().join(''))).join(''), [{ input: 'abc def', expect: 'cba fed' }]),
  T('trimspace', 'Rapikan spasi berlebih', t => t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim(), [{ input: '  a   b  \n\n\n\n c ', expect: 'a b\n\nc' }]),
  T('nospace', 'Hapus semua spasi', t => t.replace(/\s+/g, ''), [{ input: 'a b  c', expect: 'abc' }]),
  T('removeemoji', 'Hapus emoji dari teks', t => t.replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}‍️]/gu, '').replace(/ {2,}/g, ' ').trim(), [{ input: 'halo 😀 dunia 🌍', expect: 'halo dunia' }]),
  T('removenumber', 'Hapus angka dari teks', t => t.replace(/\d+/g, ''), [{ input: 'a1b22c', expect: 'abc' }]),
  T('removepunct', 'Hapus tanda baca', t => t.replace(/[\p{P}\p{S}]/gu, ''), [{ input: 'halo, dunia!', expect: 'halo dunia' }]),
  T('onlynumber', 'Ambil angkanya saja', t => (t.match(/\d+/g) || []).join(''), [{ input: 'tel: 0812-34', expect: '081234' }]),
  T('onlyletter', 'Ambil hurufnya saja', t => (t.match(/\p{L}+/gu) || []).join(''), [{ input: 'a1-b2 c', expect: 'abc' }]),
  T('sortlines', 'Urutkan baris A-Z', t => t.split('\n').sort((a, b) => a.localeCompare(b, 'id')).join('\n'), [{ input: 'c\na\nb', expect: 'a\nb\nc' }]),
  T('sortlinesdesc', 'Urutkan baris Z-A', t => t.split('\n').sort((a, b) => b.localeCompare(a, 'id')).join('\n'), [{ input: 'a\nc\nb', expect: 'c\nb\na' }]),
  T('uniquelines', 'Hapus baris duplikat', t => [...new Set(t.split('\n'))].join('\n'), [{ input: 'a\nb\na', expect: 'a\nb' }]),
  T('numberlines', 'Beri nomor setiap baris', t => t.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n'), [{ input: 'a\nb', expect: '1. a\n2. b' }]),
  T('shufflelines', 'Acak urutan baris', t => shuffle(t.split('\n')).join('\n'), [{ input: 'a\nb\nc', expect: o => o.split('\n').sort().join() === 'a,b,c' }]),
  T('shufflewords', 'Acak urutan kata', t => shuffle(t.trim().split(/\s+/)).join(' '), [{ input: 'a b c', expect: o => o.split(' ').sort().join() === 'a,b,c' }]),
  T('repeat', 'Ulangi teks: .repeat 3|teks', t => { const m = /^(\d{1,3})\s*\|\s*([\s\S]+)$/.exec(t); if (!m) return 'Format: jumlah|teks (maks 100)'; return Array(Math.min(Number(m[1]), 100)).fill(m[2]).join('\n'); }, [{ input: '2|hi', expect: 'hi\nhi' }], { usage: '<jumlah>|<teks>' }),
  T('alay', 'Ubah teks jadi gaya alay', t => t.replace(/a/gi, '4').replace(/e/gi, '3').replace(/i/gi, '1').replace(/o/gi, '0').replace(/s/gi, '5').replace(/g/gi, '9'), [{ input: 'aku sayang', expect: '4ku 54y4n9' }]),
  T('leet', '1337 sp34k (leet)', t => t.replace(/[aeiolstbg]/gi, c => ({ a: '4', e: '3', i: '1', o: '0', l: '1', s: '5', t: '7', b: '8', g: '6' })[c.toLowerCase()]), [{ input: 'leet', expect: '1337' }]),
  T('wrap', 'Bungkus teks per N karakter: .wrap 20|teks', t => { const m = /^(\d{1,3})\s*\|\s*([\s\S]+)$/.exec(t); const w = m ? Math.max(5, Number(m[1])) : 40; const s = m ? m[2] : t; const out = []; let line = ''; for (const word of s.split(/\s+/)) { if ((line + ' ' + word).trim().length > w) { if (line) out.push(line); line = word; } else line = (line + ' ' + word).trim(); } if (line) out.push(line); return out.join('\n'); }, [{ input: '10|satu dua tiga empat', expect: 'satu dua\ntiga empat' }], { usage: '[lebar]|<teks>' }),
  T('readmore', 'Teks "Baca selengkapnya" WhatsApp: .readmore depan|belakang', t => { const [a, ...b] = t.split('|'); return `${a}${'‎'.repeat(4001)}${b.join('|')}`; }, [{ input: 'a|b', expect: o => o.startsWith('a') && o.endsWith('b') && o.length === 4003 }], { usage: '<teks depan>|<teks belakang>' })
];
