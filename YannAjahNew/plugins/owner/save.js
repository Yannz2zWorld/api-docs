'use strict';
const { jidUser } = require('../../library/function');
const { O } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.save', name: 'save', aliases: ['sv'], scope: 'private', description: 'Kirim kartu kontak lawan chat (untuk disimpan)',
  async run(ctx) { const n = jidUser(ctx.m.chat); await ctx.yannajah.sendmessage(ctx.m.chat, { contacts: { displayName: n, contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${n}\nTEL;type=CELL;waid=${n}:+${n}\nEND:VCARD` }] } }, { quoted: ctx.m.raw }); } });
