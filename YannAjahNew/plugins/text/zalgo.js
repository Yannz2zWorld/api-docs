'use strict';
const { textTool } = require('../../library/plugin-kit');

module.exports = textTool({ id: 'text.zalgo', name: 'zalgo', category: 'text', description: 'T̷e̶k̸s̵ ̶z̴a̷l̵g̸o̶ (glitch)', maxInput: 300,
  fn: t => [...t].map(c => (c === ' ' ? c : c + Array.from({ length: 3 }, () => String.fromCharCode(0x0300 + require('crypto').randomInt(0, 0x6f))).join(''))).join(''),
  tests: [{ input: 'ab', expect: o => o.normalize('NFD').replace(/[̀-ͯ]/g, '') === 'ab' }] });
