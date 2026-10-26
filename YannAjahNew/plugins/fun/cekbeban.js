'use strict';
const { textTool } = require('../../library/plugin-kit');
const { cekbeban } = require('../../lib/primbon');

module.exports = textTool({ id: 'fun.cekbeban', name: 'cekbeban', category: 'fun', limit: 1, usage: '<nama>', description: 'Ukur level beban seseorang (acak)', fn: t => cekbeban(t),
  tests: [{ input: 'Budi', expect: /BEBAN METER[\s\S]*Budi/ }] });
