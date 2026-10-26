'use strict';
const { textTool } = require('../../library/plugin-kit');
const { JAWAB, pick } = require('../../lib/fun');

module.exports = textTool({ id: 'fun.apakah', name: 'apakah', category: 'fun', description: 'Tanya jawab ya/tidak acak (hiburan)', usage: '<pertanyaan>', fn: t => `❓ Apakah ${t}\n💬 ${pick(JAWAB)}`, tests: [{ input: 'aku ganteng', expect: /^❓ Apakah aku ganteng\n💬 .+/ }], aliases: ['bisakah'] });
