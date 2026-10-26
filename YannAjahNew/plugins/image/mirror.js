'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { loadImage } = require('../../lib/image');

module.exports = feature({ id: 'image.mirror', name: 'mirror', aliases: ['mirrorimg', 'mirror2', 'mirrorimg2'], category: 'image', description: 'Cermin gambar: .mirror kiri/kanan/atas/bawah (reply gambar)', usage: '<kiri|kanan|atas|bawah>', cooldown: 5, limit: 1,
  async run(ctx) {
    const mode = (ctx.args[0] || '').toLowerCase();
    if (!['kiri', 'kanan', 'atas', 'bawah'].includes(mode)) throw new UsageError(`🪞 *MIRROR*\nReply gambar lalu pilih mode:\n${ctx.prefix}mirror kiri / kanan / atas / bawah`);
    const img = await loadImage(ctx);
    const { width: w, height: h } = img.bitmap;
    const horizontal = mode === 'kiri' || mode === 'kanan';
    const half = img.clone();
    if (horizontal) { half.crop({ x: mode === 'kiri' ? 0 : Math.floor(w / 2), y: 0, w: Math.floor(w / 2), h }); const m = half.clone().flip({ horizontal: true, vertical: false }); img.composite(mode === 'kiri' ? m : half, 0, 0); img.composite(mode === 'kiri' ? half : m, Math.floor(w / 2), 0); }
    else { half.crop({ x: 0, y: mode === 'atas' ? 0 : Math.floor(h / 2), w, h: Math.floor(h / 2) }); const m = half.clone().flip({ horizontal: false, vertical: true }); img.composite(mode === 'atas' ? m : half, 0, 0); img.composite(mode === 'atas' ? half : m, 0, Math.floor(h / 2)); }
    await ctx.sendFile({ buffer: await img.getBuffer('image/png'), mime: 'image/png' }, { caption: `✅ mirror ${mode}` });
  } });
