'use strict';
const { textTool } = require('../../library/plugin-kit');
const { planet } = require('../../lib/primbon');

module.exports = textTool({ id: 'fun.planet', name: 'planet', category: 'edukasi', limit: 0, usage: '<nama planet>', description: 'Info planet tata surya', fn: planet,
  tests: [{ input: 'mars', expect: /Olympus Mons/ }, { input: 'bumi', expect: /INFO PLANET: Bumi/ }] });
