'use strict';
const crypto = require('crypto');
const { textTool } = require('../../library/plugin-kit');

module.exports = textTool({ id: 'fun.berapa', name: 'berapa', category: 'fun', description: 'Berapa ...? jawaban angka acak (hiburan)', usage: '<pertanyaan>', fn: t => `❓ Berapa ${t}\n💬 ${crypto.randomInt(0, 101)}`, tests: [{ input: 'umurku', expect: /^❓ Berapa umurku\n💬 \d+$/ }] });
