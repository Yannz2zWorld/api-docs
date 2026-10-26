'use strict';
const { textTool } = require('../../library/plugin-kit');
const { cekaura } = require('../../lib/primbon');

module.exports = textTool({ id: 'fun.cekaura', name: 'cekaura', category: 'fun', limit: 1, usage: 'HH:MM', description: 'Penerawangan aura dari jam lahir', fn: cekaura,
  tests: [{ input: '15:30', expect: /Aura Senja/ }, { input: '03:00', expect: /Kelelawar/ }] });
