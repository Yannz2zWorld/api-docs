'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { loadImage } = require('../../lib/image');

module.exports = feature({ id: 'image.crop', name: 'crop', category: 'image', description: 'Potong gambar ke rasio: .crop 1:1 / 16:9 / 9:16 / 4:3 / 3:4 (reply gambar)', usage: '<rasio>', cooldown: 5, limit: 1,
  async run(ctx) {
    const RATIOS = { '1:1': [1, 1], '16:9': [16, 9], '9:16': [9, 16], '4:3': [4, 3], '3:4': [3, 4], '4:5': [4, 5], '5:4': [5, 4], '2:1': [2, 1], '1:2': [1, 2], '21:9': [21, 9], '3:2': [3, 2], '2:3': [2, 3] };
    const r = RATIOS[(ctx.args[0] || '').trim()];
    if (!r) throw new UsageError(`Reply gambar lalu pilih rasio:\n${Object.keys(RATIOS).join(' · ')}\nContoh: ${ctx.prefix}crop 1:1`);
    const img = await loadImage(ctx);
    const { width: w, height: h } = img.bitmap;
    let cw = w, ch = Math.round(w * r[1] / r[0]);
    if (ch > h) { ch = h; cw = Math.round(h * r[0] / r[1]); }
    img.crop({ x: Math.floor((w - cw) / 2), y: Math.floor((h - ch) / 2), w: cw, h: ch });
    await ctx.sendFile({ buffer: await img.getBuffer('image/png'), mime: 'image/png' }, { caption: `✅ crop ${ctx.args[0]}` });
  } });
