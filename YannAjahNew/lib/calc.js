'use strict';
// Kalkulator & matematika. Ekspresi dihitung lewat library/mathexpr.js (tanpa eval).
const { textTool } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const { evaluate, fmt, factorial } = require('../library/mathexpr');

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

module.exports = { nums, int, rp, T, terbilang, toRoman, fromRoman, gcd, isPrime };
