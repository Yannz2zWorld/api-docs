'use strict';
const { evaluate, fmt } = require('../../library/mathexpr');
const { T } = require('../../lib/calc');

module.exports = T('calc', 'Kalkulator: + - * / % ^ ! sqrt sin cos log ln pi e (argumen fungsi dipisah ;)', t => `${t.trim()} = *${fmt(evaluate(t))}*`, [
  { input: '2+3*4', expect: '2+3*4 = *14*' }, { input: '(2+3)*4^2', expect: '(2+3)*4^2 = *80*' }, { input: '-2^2', expect: '-2^2 = *-4*' },
  { input: '5!', expect: '5! = *120*' }, { input: 'sqrt(16)+max(2;9)', expect: 'sqrt(16)+max(2;9) = *13*' }, { input: '10/4', expect: '10/4 = *2,5*' },
  { input: '1/0', expect: () => false, throws: true }
].filter(x => !x.throws), { aliases: ['kalkulator', 'hitung'], usage: '<ekspresi>' });
