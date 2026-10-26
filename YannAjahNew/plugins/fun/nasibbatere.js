'use strict';
const { textTool } = require('../../library/plugin-kit');
const { nasibbatere } = require('../../lib/primbon');

module.exports = textTool({ id: 'fun.nasibbatere', name: 'nasibbatere', category: 'fun', limit: 1, usage: '<0-100>', description: 'Ramalan nasib dari persen baterai HP', fn: nasibbatere,
  tests: [{ input: '100', expect: /overthinking/ }, { input: '50', expect: /Shopee/ }, { input: '0', expect: /Game over/ }] });
