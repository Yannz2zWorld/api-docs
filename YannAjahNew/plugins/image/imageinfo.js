'use strict';
const { feature } = require('../../library/plugin-kit');
const { loadImage } = require('../../lib/image');

module.exports = feature({ id: 'image.info', name: 'imageinfo', aliases: ['infogambar'], category: 'image', description: 'Info gambar: ukuran, resolusi, warna dominan rata-rata', cooldown: 3,
  async run(ctx) {
    const img = await loadImage(ctx);
    const { width: w, height: h, data } = img.bitmap;
    let r = 0, g = 0, b = 0; const step = Math.max(4, Math.floor(data.length / 4 / 5000) * 4);
    let n = 0; for (let i = 0; i < data.length; i += step) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
    const hex = '#' + [r, g, b].map(x => Math.round(x / n).toString(16).padStart(2, '0')).join('').toUpperCase();
    await ctx.reply(`🖼️ Resolusi: ${w}×${h} (${(w * h / 1e6).toFixed(2)} MP)\nRasio: ${(w / h).toFixed(3)}\nWarna rata-rata: ${hex}`);
  } });
