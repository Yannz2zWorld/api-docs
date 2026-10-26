'use strict';
const { textTool } = require('../../library/plugin-kit');
const { jodohmakanan } = require('../../lib/primbon');

module.exports = textTool({ id: 'fun.jodohmakanan', name: 'jodohmakanan', category: 'fun', limit: 1, usage: '<makanan>', description: 'Ramalan jodoh dari makanan favorit', fn: jodohmakanan,
  tests: [{ input: 'seblak', expect: /pedes omongannya/ }, { input: 'makananlangka123', expect: /fleksibel/ }] });
