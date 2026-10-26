'use strict';
const { UsageError } = require('../../library/errors');
const { T } = require('../../lib/text-analyze');

module.exports = T('diffline', 'Bandingkan dua teks per baris: teks1 ||| teks2', t => {
  const [a, b] = t.split('|||'); if (b === undefined) throw new UsageError('Format: teks1 ||| teks2');
  const A = a.trim().split('\n'), Bset = new Set(b.trim().split('\n')), Aset = new Set(A);
  const out = [...A.filter(l => !Bset.has(l)).map(l => `- ${l}`), ...b.trim().split('\n').filter(l => !Aset.has(l)).map(l => `+ ${l}`)];
  return out.length ? out.join('\n') : 'Tidak ada perbedaan baris.';
}, [{ input: 'a\nb ||| a\nc', expect: '- b\n+ c' }], { usage: '<teks1> ||| <teks2>' });
