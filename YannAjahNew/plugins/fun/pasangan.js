'use strict';
const crypto = require('crypto');
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { jidUser } = require('../../library/function');

module.exports = feature({ id: 'fun.pasangan', name: 'pasangan', aliases: ['jadian'], category: 'fun', scope: 'group', description: 'Pasangkan dua anggota grup secara acak (hiburan)',
  async run(ctx) { const md = ctx.m.groupMetadata; if (!md || md.participants.length < 2) throw new UsageError('Anggota kurang.'); const i = crypto.randomInt(0, md.participants.length); let k = crypto.randomInt(0, md.participants.length - 1); if (k >= i) k++; const a = md.participants[i].phoneNumber || md.participants[i].id, b = md.participants[k].phoneNumber || md.participants[k].id; await ctx.yannajah.sendmessage(ctx.m.chat, { text: `💘 @${jidUser(a)} ❤️ @${jidUser(b)}`, mentions: [a, b] }); } });
