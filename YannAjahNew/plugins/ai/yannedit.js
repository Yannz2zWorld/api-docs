'use strict';
// .yannedit <perintah>: edit gambar dengan AI (Yann AI V15 / .lenaedit Lena AI). Khusus premium.
// APIZ2Z Banana Edit, cadangan Nano Banana (mode edit).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { callFirst, sendResult } = require('../../lib/apiz2z-kit');

module.exports = feature({
  id: 'ai.yannedit', name: 'yannedit', aliases: ['yanedit'], category: 'ai', permission: 'premium', limit: 1, cooldown: 15,
  description: 'Edit gambar pakai AI sesuai perintah (reply/kirim gambar): .yannedit ubah jadi anime',
  usage: '<perintah>', params: [{ name: 'perintah', required: true, description: 'apa yang diubah di gambar' }],
  dependencies: { apiz2z: '/api/maker/bananaai' },
  async run(ctx) {
    const md = ctx.media();
    if (!md || !/^image\//.test(md.mime)) throw new UsageError(`Reply atau kirim gambar dengan caption ${ctx.prefix}${ctx.command} <perintah>\nContoh: ${ctx.prefix}${ctx.command} ubah jadi anime`);
    const prompt = ctx.requireText(`Perintahnya apa? Contoh: ${ctx.prefix}${ctx.command} ubah jadi anime`).slice(0, 500);
    await ctx.react('⏳');
    const file = { buffer: await md.download(), mime: md.mime };
    const { result } = await callFirst(ctx, [
      ['/api/maker/bananaai', { prompt }, file],
      ['/api/ai/nano-banana', { prompt, mode: 'edit' }, file]
    ]);
    await sendResult(ctx, result, { title: 'Yann Edit', category: 'ai', caption: `乂 *Yann Edit*\n◦ Perintah : ${prompt}` });
    await ctx.react('✅');
  }
});
