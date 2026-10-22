'use strict';
// Analisis teks: statistik, frekuensi kata, palindrom, anagram, waktu baca, lorem ipsum.
const { textTool, feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

const norm = s => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
const T = (name, description, fn, tests, extra = {}) => textTool({ id: `analyze.${name}`, name, category: 'text', description, fn, tests, ...extra });

const LOREM = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat'.split(' ');

module.exports = [
  T('textstat', 'Statistik teks: karakter, kata, kalimat, baris', t => {
    const words = t.trim().split(/\s+/).filter(Boolean);
    return [`Karakter: ${[...t].length}`, `Karakter tanpa spasi: ${[...t.replace(/\s/g, '')].length}`, `Kata: ${words.length}`, `Kalimat: ${(t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).filter(s => s.trim()).length}`, `Baris: ${t.split('\n').length}`, `Huruf vokal: ${(t.match(/[aiueo]/gi) || []).length}`, `Angka: ${(t.match(/\d/g) || []).length}`].join('\n');
  }, [{ input: 'Halo dunia. Apa kabar?', expect: o => o.includes('Kata: 4') && o.includes('Kalimat: 2') }], { aliases: ['hitungteks'] }),
  T('countword', 'Hitung jumlah kata', t => String(t.trim().split(/\s+/).filter(Boolean).length), [{ input: 'satu dua  tiga', expect: '3' }]),
  T('countchar', 'Hitung jumlah karakter', t => String([...t].length), [{ input: 'ab😀', expect: '3' }]),
  T('wordfreq', 'Frekuensi kata terbanyak', t => {
    const freq = {};
    for (const w of t.toLowerCase().match(/\p{L}[\p{L}\p{N}'-]*/gu) || []) freq[w] = (freq[w] || 0) + 1;
    return Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20).map(([w, n], i) => `${i + 1}. ${w} — ${n}`).join('\n') || '(tidak ada kata)';
  }, [{ input: 'a b a c a b', expect: '1. a — 3\n2. b — 2\n3. c — 1' }]),
  T('palindrome', 'Cek apakah teks palindrom', t => { const s = norm(t); return s && s === [...s].reverse().join('') ? `✅ "${t}" adalah palindrom` : `❌ "${t}" bukan palindrom`; }, [{ input: 'Kasur ini rusak', expect: o => o.startsWith('✅') }, { input: 'halo', expect: o => o.startsWith('❌') }]),
  T('anagram', 'Cek anagram: .anagram kata1|kata2', t => { const [a, b] = t.split('|'); if (!b) throw new UsageError('Format: kata1|kata2'); const k = s => [...norm(s)].sort().join(''); return k(a) === k(b) ? `✅ Anagram` : `❌ Bukan anagram`; }, [{ input: 'listen|silent', expect: '✅ Anagram' }, { input: 'abc|abd', expect: '❌ Bukan anagram' }], { usage: '<kata1>|<kata2>' }),
  T('readtime', 'Perkiraan waktu baca (200 kata/menit)', t => { const n = t.trim().split(/\s+/).filter(Boolean).length; const s = Math.ceil(n / 200 * 60); return `${n} kata ≈ ${s < 60 ? `${s} detik` : `${Math.floor(s / 60)} menit ${s % 60} detik`}`; }, [{ input: Array(400).fill('kata').join(' '), expect: '400 kata ≈ 2 menit 0 detik' }]),
  T('acronym', 'Buat singkatan dari huruf awal kata', t => t.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase(), [{ input: 'kartu tanda penduduk', expect: 'KTP' }]),
  T('vowelcount', 'Hitung huruf vokal & konsonan', t => { const v = (t.match(/[aiueo]/gi) || []).length; const c = (t.match(/[b-df-hj-np-tv-z]/gi) || []).length; return `Vokal: ${v}\nKonsonan: ${c}`; }, [{ input: 'halo', expect: 'Vokal: 2\nKonsonan: 2' }]),
  T('longestword', 'Kata terpanjang dalam teks', t => (t.match(/\p{L}+/gu) || []).reduce((a, b) => (b.length > a.length ? b : a), ''), [{ input: 'aku suka pemrograman', expect: 'pemrograman' }]),
  T('diffline', 'Bandingkan dua teks per baris: teks1 ||| teks2', t => {
    const [a, b] = t.split('|||'); if (b === undefined) throw new UsageError('Format: teks1 ||| teks2');
    const A = a.trim().split('\n'), Bset = new Set(b.trim().split('\n')), Aset = new Set(A);
    const out = [...A.filter(l => !Bset.has(l)).map(l => `- ${l}`), ...b.trim().split('\n').filter(l => !Aset.has(l)).map(l => `+ ${l}`)];
    return out.length ? out.join('\n') : 'Tidak ada perbedaan baris.';
  }, [{ input: 'a\nb ||| a\nc', expect: '- b\n+ c' }], { usage: '<teks1> ||| <teks2>' }),
  feature({ id: 'analyze.lorem', name: 'lorem', category: 'text', description: 'Generate teks lorem ipsum: .lorem [jumlah kata]', usage: '[jumlah kata]',
    pure: t => { const n = Math.min(Math.max(parseInt(t, 10) || 30, 1), 500); const out = Array.from({ length: n }, (_, i) => LOREM[i % LOREM.length]); out[0] = 'Lorem'; return out.join(' ') + '.'; },
    tests: [{ input: '5', expect: 'Lorem ipsum dolor sit amet.' }],
    async run(ctx) { await ctx.reply(this.pure(ctx.text)); } })
];
