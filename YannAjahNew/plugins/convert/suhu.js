'use strict';
const { textTool } = require('../../library/plugin-kit');
const { temp } = require('../../lib/units');

module.exports = textTool({ id: 'convert.suhu', name: 'suhu', aliases: ['temperature'], category: 'convert', description: 'Konversi suhu Celsius/Fahrenheit/Kelvin/Reamur', usage: '<nilai> <c|f|k|r> <c|f|k|r>', fn: temp,
  tests: [{ input: '100 c f', expect: '100°C = *212*°F' }, { input: '0 k c', expect: '0°K = *-273,15*°C' }] });
