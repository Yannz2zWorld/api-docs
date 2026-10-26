'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { callFirst } = require('../../lib/apiz2z-kit');
const { collectMedia, payloadOf } = require('../../library/apiz2z-render');

module.exports = feature({ id: 'downloader.tiktokmp3', name: 'tiktokmp3', aliases: ['ttmp3', 'tiktokaudio'], category: 'downloader', description: 'Ambil audio/musik dari video TikTok (MP3)', usage: '<link tiktok>', cooldown: 8, limit: 1,
  dependencies: { apiz2z: '/api/download/tiktok' },
  async run(ctx) {
    const url = (/(https?:\/\/\S*tiktok\.com\/\S+)/.exec(ctx.text || ctx.m.quoted?.text || '') || [])[1];
    if (!url) throw new UsageError(`Link TikTok-nya mana? Contoh: ${ctx.prefix}${ctx.command} https://vt.tiktok.com/xxxx`);
    await ctx.react('⏳');
    const { result } = await callFirst(ctx, [['/api/download/tiktok', { url }], ['/api/download/tiktok-v2', { url }], ['/api/download/tiktok-v3', { url }]]);
    const media = collectMedia(payloadOf(result.data));
    const audio = media.find(m => m.kind === 'audio');
    if (audio) { await ctx.sendFile(audio.url, { mimetype: 'audio/mpeg', fileName: 'tiktok.mp3' }); return ctx.react('✅'); }
    const video = media.find(m => m.kind === 'video');
    if (!video) throw new UsageError('Audio TikTok tidak ditemukan.');
    const { download } = require('../../library/net');
    const buf = (await download(video.url, { maxBytes: ctx.config.media.maxDownloadBytes, timeoutMs: ctx.config.media.downloadTimeoutMs })).buffer;
    await ctx.sendFile({ buffer: await require('../../library/converter').toMp3(buf), mime: 'audio/mpeg' }, { fileName: 'tiktok.mp3' });
    await ctx.react('✅');
  } });
