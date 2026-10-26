'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { targetJid, mention } = require('../../library/targets');
const { sock } = require('../../lib/owner-settings');

module.exports = feature({ id: 'tools.getpp', name: 'getpp', aliases: ['getprofile'], category: 'tools', description: 'Ambil foto profil WhatsApp (tag/reply/nomor)', usage: '<@tag|nomor>', limit: 1,
  async run(ctx) {
    const j = targetJid(ctx, { self: true });
    const url = await sock(ctx).profilePictureUrl(j, 'image').catch(() => null);
    if (!url) throw new UsageError(`❌ Foto profil ${mention(j)} tidak ada atau disembunyikan.`);
    await ctx.sendFile(url, { caption: `📸 Foto profil ${mention(j)}` });
  } });
