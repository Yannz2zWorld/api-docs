'use strict';
const { UsageError } = require('../../library/errors');
const { O, sock } = require('../../lib/owner');

module.exports = O({ id: 'owner.joinch', name: 'joinch', aliases: ['joinchannel'], description: 'Bot mengikuti saluran WhatsApp lewat link', usage: '<link saluran>',
  async run(ctx) {
    const m = /whatsapp\.com\/channel\/([A-Za-z0-9]{10,})/.exec(ctx.text || ctx.m.quoted?.text || '');
    if (!m) throw new UsageError('Link saluran tidak valid. Contoh: https://whatsapp.com/channel/xxxx');
    const s = sock(ctx);
    const meta = await s.newsletterMetadata('invite', m[1]);
    await s.newsletterFollow(meta.id);
    await ctx.reply(`✅ Berhasil mengikuti saluran\n• Nama: *${meta.name || meta.thread_metadata?.name?.text || '-'}*\n• Pengikut: ${(meta.subscribers ?? meta.thread_metadata?.subscribers_count ?? 0)}`);
  } });
