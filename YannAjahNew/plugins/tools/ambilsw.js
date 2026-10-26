'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

module.exports = feature({ id: 'tools.ambilsw', name: 'ambilsw', aliases: ['sw'], category: 'tools', limit: 1, description: 'Simpan gambar/video dari status WhatsApp yang kamu reply',
  async run(ctx) {
    const q = ctx.m.quoted; if (!q?.isMedia || !/image|video/.test(q.mime)) throw new UsageError('📌 Balas status gambar/video yang ingin diambil!');
    await ctx.sendFile(await q.download(), { caption: q.text || '' });
  } });
