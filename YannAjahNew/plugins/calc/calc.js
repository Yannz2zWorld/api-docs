'use strict';
// Kalkulator & matematika. Ekspresi dihitung lewat library/mathexpr.js (tanpa eval).
const { textTool } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { evaluate, fmt, factorial } = require('../../library/mathexpr');

const nums = (t, n, label) => {
  const parts = t.trim().split(/[\s|;]+/).map(x => Number(x.replace(',', '.')));
  if (parts.length < n || parts.slice(0, n).some(x => !Number.isFinite(x))) throw new UsageError(`Butuh ${n} angka: ${label}`);
  return parts;
};
const int = (x, label = 'angka') => { const v = Number(x); if (!Number.isSafeInteger(v)) throw new UsageError(`${label} harus bilangan bulat.`); return v; };
const rp = n => 'Rp' + Math.round(n).toLocaleString('id-ID');
const T = (name, description, fn, tests, extra = {}) => textTool({ id: `calc.${name}`, name, category: 'calc', description, fn, tests, ...extra });

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
function terbilang(n) {
  if (n < 12) return SATUAN[n];
  if (n < 20) return terbilang(n - 10) + ' belas';
  if (n < 100) return (terbilang(Math.floor(n / 10)) + ' puluh ' + terbilang(n % 10)).trim();
  if (n < 200) return ('seratus ' + terbilang(n - 100)).trim();
  if (n < 1000) return (terbilang(Math.floor(n / 100)) + ' ratus ' + terbilang(n % 100)).trim();
  if (n < 2000) return ('seribu ' + terbilang(n - 1000)).trim();
  for (const [v, w] of [[1e12, 'triliun'], [1e9, 'miliar'], [1e6, 'juta'], [1e3, 'ribu']]) if (n >= v) return (terbilang(Math.floor(n / v)) + ` ${w} ` + terbilang(n % v)).trim();
  return '';
}
function toRoman(n) {
  if (!Number.isInteger(n) || n < 1 || n > 3999) throw new UsageError('Angka Romawi 1 - 3999.');
  return [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
}
function fromRoman(s) {
  s = s.toUpperCase().trim();
  if (!/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(s) || !s) throw new UsageError('Bukan angka Romawi yang valid.');
  const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  return [...s].reduce((sum, c, i, a) => sum + (v[c] < (v[a[i + 1]] || 0) ? -v[c] : v[c]), 0);
}
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
function isPrime(n) { if (n < 2) return false; if (n % 2 === 0) return n === 2; for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false; return true; }

module.exports = [
  T('calc', 'Kalkulator: + - * / % ^ ! sqrt sin cos log ln pi e (argumen fungsi dipisah ;)', t => `${t.trim()} = *${fmt(evaluate(t))}*`, [
    { input: '2+3*4', expect: '2+3*4 = *14*' }, { input: '(2+3)*4^2', expect: '(2+3)*4^2 = *80*' }, { input: '-2^2', expect: '-2^2 = *-4*' },
    { input: '5!', expect: '5! = *120*' }, { input: 'sqrt(16)+max(2;9)', expect: 'sqrt(16)+max(2;9) = *13*' }, { input: '10/4', expect: '10/4 = *2,5*' },
    { input: '1/0', expect: () => false, throws: true }
  ].filter(x => !x.throws), { aliases: ['kalkulator', 'hitung'], usage: '<ekspresi>' }),
  T('persen', 'Hitung persen: .persen 15 200 (15% dari 200)', t => { const [p, n] = nums(t, 2, 'persen nilai'); return `${p}% dari ${fmt(n)} = *${fmt(p / 100 * n)}*`; }, [{ input: '15 200', expect: '15% dari 200 = *30*' }], { usage: '<persen> <nilai>' }),
  T('diskon', 'Harga setelah diskon: .diskon 250000 20', t => { const [h, d] = nums(t, 2, 'harga diskon%'); return `Harga awal: ${rp(h)}\nDiskon ${d}%: -${rp(h * d / 100)}\nBayar: *${rp(h * (1 - d / 100))}*`; }, [{ input: '250000 20', expect: o => o.includes('Bayar: *Rp200.000*') }], { usage: '<harga> <diskon%>' }),
  T('ppn', 'Hitung PPN: .ppn 100000 [tarif% default 11]', t => { const p = t.trim().split(/\s+/).map(Number); if (!Number.isFinite(p[0])) throw new UsageError('Format: .ppn <harga> [tarif%]'); const r = Number.isFinite(p[1]) ? p[1] : 11; return `DPP: ${rp(p[0])}\nPPN ${r}%: ${rp(p[0] * r / 100)}\nTotal: *${rp(p[0] * (1 + r / 100))}*`; }, [{ input: '100000', expect: o => o.includes('Total: *Rp111.000*') }], { usage: '<harga> [tarif%]' }),
  T('cicilan', 'Cicilan per bulan (anuitas): .cicilan pokok bunga%/tahun bulan', t => { const [P, r, n] = nums(t, 3, 'pokok bunga% bulan'); if (n <= 0 || n > 600) throw new UsageError('Tenor 1-600 bulan.'); const i = r / 100 / 12; const a = i === 0 ? P / n : P * i / (1 - Math.pow(1 + i, -n)); return `Cicilan/bulan: *${rp(a)}*\nTotal bayar: ${rp(a * n)}\nTotal bunga: ${rp(a * n - P)}`; }, [{ input: '12000000 0 12', expect: o => o.startsWith('Cicilan/bulan: *Rp1.000.000*') }, { input: '10000000 12 12', expect: o => o.startsWith('Cicilan/bulan: *Rp888.488*') }], { usage: '<pokok> <bunga%/thn> <bulan>' }),
  T('bungamajemuk', 'Bunga majemuk: .bungamajemuk pokok bunga%/tahun tahun', t => { const [P, r, y] = nums(t, 3, 'pokok bunga% tahun'); const A = P * Math.pow(1 + r / 100, y); return `Nilai akhir: *${rp(A)}*\nBunga: ${rp(A - P)}`; }, [{ input: '1000000 10 2', expect: o => o.startsWith('Nilai akhir: *Rp1.210.000*') }], { usage: '<pokok> <bunga%> <tahun>' }),
  T('bungatunggal', 'Bunga tunggal: .bungatunggal pokok bunga%/tahun tahun', t => { const [P, r, y] = nums(t, 3, 'pokok bunga% tahun'); return `Bunga: ${rp(P * r / 100 * y)}\nTotal: *${rp(P * (1 + r / 100 * y))}*`; }, [{ input: '1000000 10 2', expect: o => o.endsWith('*Rp1.200.000*') }], { usage: '<pokok> <bunga%> <tahun>' }),
  T('patungan', 'Bagi tagihan: .patungan total orang [tip%]', t => { const p = nums(t, 2, 'total orang'); const tip = p[2] || 0; const tot = p[0] * (1 + tip / 100); if (p[1] < 1) throw new UsageError('Jumlah orang minimal 1.'); return `Total${tip ? ` (+tip ${tip}%)` : ''}: ${rp(tot)}\nPer orang (${p[1]}): *${rp(Math.ceil(tot / p[1]))}*`; }, [{ input: '300000 3', expect: o => o.endsWith('*Rp100.000*') }], { usage: '<total> <orang> [tip%]' }),
  T('bmi', 'Indeks massa tubuh: .bmi berat(kg) tinggi(cm)', t => { const [w, h] = nums(t, 2, 'berat tinggi'); const b = w / Math.pow(h / 100, 2); const cat = b < 18.5 ? 'Kurus' : b < 25 ? 'Normal' : b < 30 ? 'Gemuk' : 'Obesitas'; return `BMI: *${b.toFixed(1)}* (${cat})`; }, [{ input: '70 175', expect: 'BMI: *22.9* (Normal)' }], { usage: '<berat kg> <tinggi cm>' }),
  T('gcd', 'FPB dari beberapa bilangan', t => `FPB = *${t.trim().split(/[\s,;]+/).map(x => int(x)).reduce(gcd)}*`, [{ input: '12 18 24', expect: 'FPB = *6*' }], { aliases: ['fpb'], usage: '<a> <b> ...' }),
  T('lcm', 'KPK dari beberapa bilangan', t => `KPK = *${t.trim().split(/[\s,;]+/).map(x => int(x)).reduce((a, b) => Math.abs(a * b) / gcd(a, b))}*`, [{ input: '4 6', expect: 'KPK = *12*' }], { aliases: ['kpk'], usage: '<a> <b> ...' }),
  T('isprime', 'Cek bilangan prima', t => { const n = int(t.trim()); if (n > 1e12) throw new UsageError('Maks 10^12.'); return isPrime(n) ? `✅ ${n} adalah bilangan prima` : `❌ ${n} bukan bilangan prima`; }, [{ input: '97', expect: '✅ 97 adalah bilangan prima' }, { input: '91', expect: '❌ 91 bukan bilangan prima' }], { aliases: ['prima'] }),
  T('factorize', 'Faktorisasi prima', t => { let n = int(t.trim()); if (n < 2 || n > 1e12) throw new UsageError('Angka 2 .. 10^12.'); const f = []; for (let d = 2; d * d <= n; d++) while (n % d === 0) { f.push(d); n /= d; } if (n > 1) f.push(n); return f.join(' × '); }, [{ input: '360', expect: '2 × 2 × 2 × 3 × 3 × 5' }], { aliases: ['faktorprima'] }),
  T('fibonacci', 'Deret Fibonacci n suku pertama (maks 90)', t => { const n = Math.min(int(t.trim()), 90); const a = [0, 1]; while (a.length < n) a.push(a[a.length - 1] + a[a.length - 2]); return a.slice(0, n).join(', '); }, [{ input: '8', expect: '0, 1, 1, 2, 3, 5, 8, 13' }]),
  T('factorial', 'Faktorial n! (maks 170, eksak sampai 25 dengan BigInt)', t => { const n = int(t.trim()); if (n <= 25 && n >= 0) { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return `${n}! = ${r}`; } return `${n}! ≈ ${factorial(n).toExponential(6)}`; }, [{ input: '20', expect: '20! = 2432902008176640000' }]),
  T('basenum', 'Konversi basis bilangan: .basenum 255 10 16', t => { const [v, from, to] = t.trim().split(/\s+/); const f = int(from, 'basis asal'), tt = int(to, 'basis tujuan'); if (f < 2 || f > 36 || tt < 2 || tt > 36) throw new UsageError('Basis 2-36.'); if (!new RegExp(`^[${'0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, f)}]+$`, 'i').test(v || '')) throw new UsageError(`"${v}" bukan bilangan basis ${f}.`); return `${v} (basis ${f}) = *${BigInt(parseInt(v, f)).toString(tt).toUpperCase()}* (basis ${tt})`; }, [{ input: 'ff 16 2', expect: 'ff (basis 16) = *11111111* (basis 2)' }], { usage: '<nilai> <basis asal> <basis tujuan>' }),
  T('roman', 'Angka ke Romawi', t => toRoman(int(t.trim())), [{ input: '2024', expect: 'MMXXIV' }], { aliases: ['romawi'] }),
  T('deroman', 'Romawi ke angka', t => String(fromRoman(t)), [{ input: 'MCMXCIV', expect: '1994' }]),
  T('terbilang', 'Angka ke kata (Bahasa Indonesia)', t => { const n = int(t.trim().replace(/[.\s]/g, '')); if (n < 0 || n >= 1e15) throw new UsageError('0 .. 999 triliun.'); return n === 0 ? 'nol' : terbilang(n); }, [{ input: '1.250.075', expect: 'satu juta dua ratus lima puluh ribu tujuh puluh lima' }, { input: '115', expect: 'seratus lima belas' }]),
  T('stats', 'Statistik data: rata-rata, median, modus, simpangan baku', t => { const a = t.trim().split(/[\s,;]+/).map(Number); if (a.length < 1 || a.some(x => !Number.isFinite(x))) throw new UsageError('Masukkan daftar angka.'); const s = [...a].sort((x, y) => x - y); const mean = a.reduce((x, y) => x + y, 0) / a.length; const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; const cnt = {}; a.forEach(x => (cnt[x] = (cnt[x] || 0) + 1)); const mx = Math.max(...Object.values(cnt)); const mode = Object.keys(cnt).filter(k => cnt[k] === mx).join(', '); const sd = Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / a.length); return `n: ${a.length}\nMin: ${s[0]}  Max: ${s[s.length - 1]}\nRata-rata: ${fmt(mean)}\nMedian: ${fmt(med)}\nModus: ${mx > 1 ? mode : '-'}\nSimpangan baku: ${fmt(sd)}`; }, [{ input: '2 4 4 4 5 5 7 9', expect: o => o.includes('Rata-rata: 5') && o.includes('Median: 4,5') && o.includes('Modus: 4') && o.includes('Simpangan baku: 2') }], { usage: '<angka...>' }),
  T('kuadrat', 'Akar persamaan kuadrat ax²+bx+c=0: .kuadrat a b c', t => { const [a, b, c] = nums(t, 3, 'a b c'); if (a === 0) throw new UsageError('a tidak boleh 0.'); const D = b * b - 4 * a * c; if (D < 0) { const re = -b / (2 * a), im = Math.sqrt(-D) / (2 * a); return `D = ${D}\nx = ${fmt(re)} ± ${fmt(Math.abs(im))}i`; } const x1 = (-b + Math.sqrt(D)) / (2 * a), x2 = (-b - Math.sqrt(D)) / (2 * a); return `D = ${D}\nx1 = ${fmt(x1)}\nx2 = ${fmt(x2)}`; }, [{ input: '1 -3 2', expect: 'D = 1\nx1 = 2\nx2 = 1' }], { usage: '<a> <b> <c>' }),
  T('pythagoras', 'Sisi miring segitiga siku-siku: .pythagoras a b', t => { const [a, b] = nums(t, 2, 'a b'); return `c = *${fmt(Math.hypot(a, b))}*`; }, [{ input: '3 4', expect: 'c = *5*' }], { usage: '<a> <b>' }),
  T('luas', 'Luas bangun: .luas persegi 4 | persegipanjang 3 5 | segitiga 3 4 | lingkaran 7 | trapesium 3 5 4', t => { const [s, ...v] = t.trim().toLowerCase().split(/\s+/); const n = v.map(Number); const f = { persegi: () => n[0] ** 2, persegipanjang: () => n[0] * n[1], segitiga: () => n[0] * n[1] / 2, lingkaran: () => Math.PI * n[0] ** 2, trapesium: () => (n[0] + n[1]) / 2 * n[2], jajargenjang: () => n[0] * n[1], belahketupat: () => n[0] * n[1] / 2 }[s]; if (!f) throw new UsageError('Bangun: persegi, persegipanjang, segitiga, lingkaran, trapesium, jajargenjang, belahketupat'); const r = f(); if (!Number.isFinite(r)) throw new UsageError('Ukuran kurang lengkap.'); return `Luas ${s} = *${fmt(r)}*`; }, [{ input: 'lingkaran 7', expect: /^Luas lingkaran = \*153,938/ }, { input: 'trapesium 3 5 4', expect: 'Luas trapesium = *16*' }], { usage: '<bangun> <ukuran...>' }),
  T('volume', 'Volume bangun ruang: .volume kubus 3 | balok 2 3 4 | bola 7 | tabung 7 10 | kerucut 7 10 | prisma luasalas tinggi | limas luasalas tinggi', t => { const [s, ...v] = t.trim().toLowerCase().split(/\s+/); const n = v.map(Number); const f = { kubus: () => n[0] ** 3, balok: () => n[0] * n[1] * n[2], bola: () => 4 / 3 * Math.PI * n[0] ** 3, tabung: () => Math.PI * n[0] ** 2 * n[1], kerucut: () => Math.PI * n[0] ** 2 * n[1] / 3, prisma: () => n[0] * n[1], limas: () => n[0] * n[1] / 3 }[s]; if (!f) throw new UsageError('Bangun: kubus, balok, bola, tabung, kerucut, prisma, limas'); const r = f(); if (!Number.isFinite(r)) throw new UsageError('Ukuran kurang lengkap.'); return `Volume ${s} = *${fmt(r)}*`; }, [{ input: 'balok 2 3 4', expect: 'Volume balok = *24*' }], { usage: '<bangun> <ukuran...>' }),
  T('random', 'Angka acak: .random min max', t => { const [a, b] = nums(t, 2, 'min max'); const lo = Math.ceil(Math.min(a, b)), hi = Math.floor(Math.max(a, b)); if (hi - lo > 1e12) throw new UsageError('Rentang terlalu besar.'); return `🎲 ${lo + require('crypto').randomInt(0, hi - lo + 1)}`; }, [{ input: '5 5', expect: '🎲 5' }], { aliases: ['acakangka'], usage: '<min> <max>' }),
  T('average', 'Rata-rata nilai (misal nilai rapor)', t => { const a = t.trim().split(/[\s,;]+/).map(Number); if (!a.length || a.some(x => !Number.isFinite(x))) throw new UsageError('Masukkan daftar angka.'); return `Rata-rata dari ${a.length} nilai = *${fmt(a.reduce((x, y) => x + y, 0) / a.length)}*`; }, [{ input: '80 90 100', expect: 'Rata-rata dari 3 nilai = *90*' }], { aliases: ['ratarata'] })
];
