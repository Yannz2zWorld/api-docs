'use strict';
// ----------------------------------------------------------------- channel & profil
const { UsageError } = require('../../library/errors');
const { O } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.upchannel', name: 'upchannel', aliases: ['upch', 'kirimch', 'upchannel2'], description: 'Kirim teks/media ke channel bot (links.channelId)', usage: '<teks> (atau reply media)',
  async run(ctx) {
    const ch = ctx.config.links.channelId; if (!/@newsletter$/.test(ch || '')) throw new UsageError('ID channel belum diatur (renamebot idsaluran ...@newsletter).');
    const md = ctx.media();
    if (md) await ctx.yannajah.sendFile(ch, await md.download(), { caption: ctx.text || ctx.m.quoted?.text || '' });
    else await ctx.yannajah.sendmessage(ch, { text: ctx.requireText() });
    await ctx.reply('✅ Berhasil dikirim ke channel.');
  } });
