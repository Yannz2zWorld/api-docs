'use strict';
const { T } = require('../../lib/text-analyze');

module.exports = T('textstat', 'Statistik teks: karakter, kata, kalimat, baris', t => {
  const words = t.trim().split(/\s+/).filter(Boolean);
  return [`Karakter: ${[...t].length}`, `Karakter tanpa spasi: ${[...t.replace(/\s/g, '')].length}`, `Kata: ${words.length}`, `Kalimat: ${(t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).filter(s => s.trim()).length}`, `Baris: ${t.split('\n').length}`, `Huruf vokal: ${(t.match(/[aiueo]/gi) || []).length}`, `Angka: ${(t.match(/\d/g) || []).length}`].join('\n');
}, [{ input: 'Halo dunia. Apa kabar?', expect: o => o.includes('Kata: 4') && o.includes('Kalimat: 2') }], { aliases: ['hitungteks'] });
