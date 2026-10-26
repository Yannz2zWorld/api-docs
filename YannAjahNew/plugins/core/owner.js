'use strict';
const { feature } = require('../../library/plugin-kit');

module.exports = feature({ id: 'core.owner', name: 'owner', aliases: ['creator', 'developerbot'], category: 'core', description: 'Kontak owner bot',
  async run(ctx) {
    const n = ctx.config.owner.number, name = ctx.config.owner.name.replace(/[\r\n;]/g, ' ');
    await ctx.yannajah.sendmessage(ctx.m.chat, { contacts: { displayName: name, contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;waid=${n}:+${n}\nEND:VCARD` }] } }, { quoted: ctx.m.raw });
  } });
