'use strict';
// .igquote <teks>: gambar quote ala Instagram (Lena AI). Avatar = foto profil pengirim, atau
// pengirim pesan yang di-reply (teksnya dipakai kalau tanpa argumen).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { callFirst, sendResult } = require('../../lib/apiz2z-kit');

module.exports = feature({
  id: 'maker.igquote', name: 'igquote', aliases: ['ignote', 'igq', 'instagramquote'], category: 'maker', limit: 1, cooldown: 5,
  description: 'Gambar quote ala Instagram (foto profil otomatis): .igquote <teks> atau reply pesan',
  usage: '<teks>', params: [{ name: 'teks', required: true, description: 'isi quote (atau reply pesan)' }],
  dependencies: { apiz2z: '/api/canvas/igqc' },
  async run(ctx) {
    const fromQuoted = !ctx.text && Boolean(ctx.m.quoted?.text);
    const text = (ctx.text || ctx.m.quoted?.text || '').trim();
    if (!text) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} hidup itu indah\n(bisa juga reply pesan seseorang)`);
    if (text.length > 500) throw new UsageError('Teks maksimal 500 karakter.');
    const who = fromQuoted ? ctx.m.quoted.sender : ctx.m.sender;
    const image = await ctx.yannajah.socket?.profilePictureUrl(who, 'image').catch(() => null);
    await ctx.react('⏳');
    const { result } = await callFirst(ctx, [['/api/canvas/igqc', image ? { text, image } : { text }]]);
    await sendResult(ctx, result, { title: 'Instagram Quote', category: 'canvas', caption: '乂 *Instagram Quote*' });
    await ctx.react('✅');
  }
});
