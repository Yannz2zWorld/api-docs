'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { loadBaileys } = require('../../library/connection');
const { sock } = require('../../lib/owner-settings');

module.exports = feature({ id: 'group.swgc', name: 'swgc', aliases: ['statusgrup'], category: 'group', scope: 'group', permission: 'admin', description: 'Buat status grup dari teks/gambar/video (reply media + caption)', usage: '<teks>',
  async run(ctx) {
    const md = ctx.media(); if (!md && !ctx.text) throw new UsageError(`Contoh: reply gambar lalu ${ctx.prefix}swgc caption`);
    const B = await loadBaileys(); const s = sock(ctx);
    const content = md ? { [/video/.test(md.mime) ? 'video' : /audio/.test(md.mime) ? 'audio' : 'image']: await md.download(), caption: ctx.text } : { text: ctx.text };
    const msg = await B.generateWAMessageContent(content, { upload: s.waUploadToServer });
    await s.relayMessage(ctx.m.chat, { groupStatusMessageV2: { message: msg } }, {});
    await ctx.reply('✅ Status grup dibuat.');
  } });
