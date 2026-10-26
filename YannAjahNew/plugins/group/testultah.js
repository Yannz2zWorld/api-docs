'use strict';
const { mention } = require('../../library/targets');
const { A } = require('../../lib/group-activity');

module.exports = A({ id: 'group.testultah', name: 'testultah', description: 'Tes pesan ucapan ulang tahun',
  async run(ctx) { await ctx.reply(`🎂 Selamat ulang tahun ${mention(ctx.m.sender)}! 🎉\nSemoga panjang umur, sehat selalu, dan sukses! 🥳`); } });
