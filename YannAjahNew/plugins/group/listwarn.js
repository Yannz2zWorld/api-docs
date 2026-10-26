'use strict';
const { jidUser } = require('../../library/function');
const { G } = require('../../lib/group');

module.exports = G({ id: 'group.listwarn', name: 'listwarn', aliases: ['cekwarn', 'listwarning', 'warninglist', 'warnlist', 'ceklistwarn'], description: 'Daftar peringatan di grup ini',
  async run(ctx) {
    const w = Object.entries(ctx.group.warns || {});
    if (!w.length) return ctx.reply('Tidak ada anggota yang punya peringatan.');
    await ctx.yannajah.sendmessage(ctx.m.chat, { text: w.map(([j, n]) => `@${jidUser(j)}: ${n}/${ctx.config.limit.warnBeforeKick}`).join('\n'), mentions: w.map(x => x[0]) }, { quoted: ctx.m.raw });
  } });
