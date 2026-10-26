'use strict';
const { feature, inputText } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { photoOf, ytComment } = require('../../lib/memecanvas');

module.exports = feature({ id: 'maker.ytcomment', name: 'ytcomment', aliases: ['youtubecomment'], category: 'maker', description: 'Gambar komentar YouTube dengan nama & foto profilmu', usage: '<komentar>', cooldown: 5, limit: 1,
  async run(ctx) {
    const text = inputText(ctx).slice(0, 300);
    if (!text) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} keren banget videonya`);
    const buf = await ytComment({ photo: await photoOf(ctx, ctx.m.sender), name: ctx.m.pushName || 'user', text });
    await ctx.sendFile({ buffer: buf, mime: 'image/png' });
  } });
