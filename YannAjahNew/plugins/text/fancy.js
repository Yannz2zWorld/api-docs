'use strict';
const { textTool } = require('../../library/plugin-kit');
const { STYLES, apply, upsideDown } = require('../../lib/fonts');

module.exports = textTool({ id: 'font.all', name: 'fancy', aliases: ['font'], category: 'text', description: 'Tampilkan teks dalam semua gaya huruf', maxInput: 200,
  fn: t => Object.entries(STYLES).map(([n, [, fn]]) => `*${n}*: ${n === 'upsidedown' ? upsideDown(t) : apply(fn)(t)}`).join('\n'),
  tests: [{ input: 'Ab', expect: o => o.includes('𝐀𝐛') && o.split('\n').length === Object.keys(STYLES).length }] });
