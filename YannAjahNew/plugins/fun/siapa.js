'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { jidUser } = require('../../library/function');
const { pick } = require('../../lib/fun');

module.exports = feature({ id: 'fun.siapa', name: 'siapa', aliases: ['siapakah'], category: 'fun', scope: 'group', description: 'Pilih anggota grup secara acak untuk sebuah pertanyaan', usage: '<pertanyaan>',
  async run(ctx) { const md = ctx.m.groupMetadata; if (!md) throw new UsageError('Data grup belum tersedia.'); const p = pick(md.participants); const j = p.phoneNumber || p.id; await ctx.yannajah.sendmessage(ctx.m.chat, { text: `❓ Siapa ${ctx.requireText()}\n💬 @${jidUser(j)}`, mentions: [j] }, { quoted: ctx.m.raw }); } });
