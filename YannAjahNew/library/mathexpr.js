'use strict';
// Evaluator ekspresi matematika TANPA eval(): tokenizer + shunting-yard + evaluasi RPN.
// Operator: + - * / % ^ (pangkat, asosiatif kanan), ! (faktorial), kurung, minus unary.
// Fungsi: sqrt cbrt abs round floor ceil sin cos tan asin acos atan log (basis 10) ln exp min max.
// Konstanta: pi, e. Simbol × ÷ juga diterima. Batas panjang input & nilai faktorial.

const { UsageError } = require('./errors');

const FUNCS = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  log: Math.log10, ln: Math.log, exp: Math.exp, min: Math.min, max: Math.max
};
const ARITY = { min: 2, max: 2 };
const CONSTS = { pi: Math.PI, e: Math.E };
const OPS = { '+': [1, 'L'], '-': [1, 'L'], '*': [2, 'L'], '/': [2, 'L'], '%': [2, 'L'], '^': [4, 'R'], 'neg': [3, 'R'] };

function tokenize(src) {
  const s = String(src).replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.').replace(/\*\*/g, '^').toLowerCase();
  if (s.length > 300) throw new UsageError('Ekspresi terlalu panjang (maks 300 karakter).');
  const out = [];
  const re = /\s*(\d+(?:\.\d+)?(?:e[+-]?\d+)?|\.\d+|[a-z]+|[-+*/%^()!;])/gy;
  let m, last = 0;
  while ((m = re.exec(s))) { out.push(m[1]); last = re.lastIndex; }
  if (s.slice(last).trim()) throw new UsageError(`Karakter tidak dikenal: "${s.slice(last).trim()[0]}"`);
  return out;
}

function factorial(n) {
  if (!Number.isInteger(n) || n < 0) throw new UsageError('Faktorial hanya untuk bilangan bulat ≥ 0.');
  if (n > 170) throw new UsageError('Faktorial maksimal 170!.');
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
}

function toRpn(tokens) {
  const out = [], stack = [];
  let prev = null;
  for (const t of tokens) {
    if (/^[\d.]/.test(t)) out.push(Number(t));
    else if (CONSTS[t] !== undefined) out.push(CONSTS[t]);
    else if (FUNCS[t]) stack.push(t);
    else if (t === ';') { while (stack.length && stack[stack.length - 1] !== '(') out.push(stack.pop()); }
    else if (t === '(') stack.push(t);
    else if (t === ')') {
      while (stack.length && stack[stack.length - 1] !== '(') out.push(stack.pop());
      if (!stack.length) throw new UsageError('Kurung tidak seimbang.');
      stack.pop();
      if (FUNCS[stack[stack.length - 1]]) out.push(stack.pop());
    } else if (t === '!') out.push('!');
    else if (OPS[t]) {
      let op = t;
      const unary = prev === null || (OPS[prev] && prev !== ')') || prev === '(' || prev === 'neg' || prev === ';';
      if (unary) { if (t === '-') op = 'neg'; else if (t === '+') { prev = t; continue; } else throw new UsageError(`Operator "${t}" salah tempat.`); }
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (!OPS[top]) break;
        const [p1, a1] = OPS[op], [p2] = OPS[top];
        if ((a1 === 'L' && p1 <= p2) || (a1 === 'R' && p1 < p2)) out.push(stack.pop()); else break;
      }
      stack.push(op);
      prev = op; continue;
    } else if (/^[a-z]+$/.test(t)) throw new UsageError(`Fungsi/konstanta tidak dikenal: ${t}`);
    prev = t;
  }
  while (stack.length) { const x = stack.pop(); if (x === '(') throw new UsageError('Kurung tidak seimbang.'); out.push(x); }
  return out;
}

function evalRpn(rpn) {
  const st = [];
  const pop = () => { if (!st.length) throw new UsageError('Ekspresi tidak lengkap.'); return st.pop(); };
  for (const x of rpn) {
    if (typeof x === 'number') st.push(x);
    else if (x === 'neg') st.push(-pop());
    else if (x === '!') st.push(factorial(pop()));
    else if (FUNCS[x]) { const n = ARITY[x] || 1; const args = Array.from({ length: n }, pop).reverse(); st.push(FUNCS[x](...args)); }
    else {
      const b = pop(), a = pop();
      st.push(x === '+' ? a + b : x === '-' ? a - b : x === '*' ? a * b : x === '/' ? a / b : x === '%' ? a % b : Math.pow(a, b));
    }
  }
  if (st.length !== 1) throw new UsageError('Ekspresi tidak valid.');
  const v = st[0];
  if (!Number.isFinite(v)) throw new UsageError(Number.isNaN(v) ? 'Hasil tidak terdefinisi.' : 'Hasil tak hingga (misal pembagian dengan nol).');
  return v;
}

function evaluate(expr) { return evalRpn(toRpn(tokenize(expr))); }
const fmt = v => (Number.isInteger(v) ? v.toLocaleString('id-ID') : Number(v.toPrecision(12)).toLocaleString('id-ID', { maximumFractionDigits: 10 }));

module.exports = { evaluate, tokenize, toRpn, fmt, factorial };
