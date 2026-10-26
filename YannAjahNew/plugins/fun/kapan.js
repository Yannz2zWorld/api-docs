'use strict';
const { textTool } = require('../../library/plugin-kit');
const { KAPAN, pick } = require('../../lib/fun');

module.exports = textTool({ id: 'fun.kapan', name: 'kapan', aliases: ['kapankah'], category: 'fun', description: 'Kapan sesuatu terjadi? (hiburan)', usage: '<pertanyaan>', fn: t => `❓ Kapan ${t}\n💬 ${pick(KAPAN)}`, tests: [{ input: 'aku kaya', expect: /^❓ Kapan aku kaya\n💬 .+/ }] });
