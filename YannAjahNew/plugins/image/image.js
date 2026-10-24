'use strict';
// Efek gambar lokal dengan Jimp (tanpa API eksternal). Input: kirim/reply gambar.
const { Jimp } = require('jimp');
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

const MAX_SIDE = 2048;
async function loadImage(ctx) {
  const md = ctx.media();
  if (!md || !/^image\/(jpeg|png|webp|bmp|gif)/.test(md.mime)) throw new UsageError(`Kirim atau reply gambar dengan caption ${ctx.prefix}${ctx.command}`);
  let buf = await md.download();
  if (md.mime === 'image/webp') buf = await require('../../library/media').toPng(buf);
  const img = await Jimp.read(buf);
  if (Math.max(img.bitmap.width, img.bitmap.height) > MAX_SIDE) img.scaleToFit({ w: MAX_SIDE, h: MAX_SIDE });
  return img;
}
const num = (v, lo, hi, dflt) => { if (v === undefined || v === '') return dflt; const n = Number(v); if (!(n >= lo && n <= hi)) throw new UsageError(`Nilai harus ${lo} - ${hi}.`); return n; };

// name: [deskripsi, usage, fn(img, args)]
const EFFECTS = {
  grayscale: ['Hitam putih', '', img => img.greyscale()],
  invert: ['Warna terbalik (negatif)', '', img => img.invert()],
  sepia: ['Efek sepia (foto jadul)', '', img => img.sepia()],
  blurimg: ['Blur gambar: .blurimg [1-50]', '[radius]', (img, a) => img.blur(num(a[0], 1, 50, 8))],
  pixelate: ['Pikselasi: .pixelate [2-100]', '[ukuran]', (img, a) => img.pixelate({ size: num(a[0], 2, 100, 12) })],
  posterize: ['Posterize: .posterize [2-20]', '[level]', (img, a) => img.posterize(num(a[0], 2, 20, 5))],
  brightness: ['Kecerahan: .brightness [-1..1]', '[nilai]', (img, a) => img.brightness(1 + num(a[0], -1, 1, 0.3))],
  contrast: ['Kontras: .contrast [-1..1]', '[nilai]', (img, a) => img.contrast(num(a[0], -1, 1, 0.3))],
  fliph: ['Balik horizontal (cermin)', '', img => img.flip({ horizontal: true, vertical: false })],
  flipv: ['Balik vertikal', '', img => img.flip({ horizontal: false, vertical: true })],
  rotate: ['Putar gambar: .rotate [derajat]', '[derajat]', (img, a) => img.rotate(num(a[0], -360, 360, 90))],
  resize: ['Ubah ukuran: .resize <lebar> [tinggi]', '<lebar> [tinggi]', (img, a) => { const w = num(a[0], 16, MAX_SIDE, null); if (!w) throw new UsageError('Lebar wajib.'); const h = num(a[1], 16, MAX_SIDE, null); return img.resize(h ? { w, h } : { w }); }],
  square: ['Potong jadi persegi (tengah)', '', img => { const s = Math.min(img.bitmap.width, img.bitmap.height); return img.cover({ w: s, h: s }); }],
  circleimg: ['Potong bulat', '', img => { const s = Math.min(img.bitmap.width, img.bitmap.height); return img.cover({ w: s, h: s }).circle(); }],
  normalize: ['Normalisasi warna otomatis', '', img => img.normalize()],
  dither: ['Efek dither', '', img => img.dither()],
  threshold: ['Hitam-putih tegas (threshold): .threshold [0-255]', '[nilai]', (img, a) => img.greyscale().threshold({ max: num(a[0], 0, 255, 128) })],
  fade: ['Transparansi: .fade [0-1]', '[nilai]', (img, a) => img.fade(num(a[0], 0, 1, 0.5))],
  gaussian: ['Gaussian blur halus: .gaussian [1-10]', '[radius]', (img, a) => img.gaussian(num(a[0], 1, 10, 3))],
  emboss: ['Efek emboss', '', img => img.convolute([[-2, -1, 0], [-1, 1, 1], [0, 1, 2]])],
  sharpen: ['Pertajam gambar', '', img => img.convolute([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])],
  edge: ['Deteksi tepi (sketsa garis)', '', img => img.greyscale().convolute([[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]])]
};

module.exports = [
  ...Object.entries(EFFECTS).map(([name, [desc, usage, fn]]) => feature({
    id: `image.${name}`, name, category: 'image', description: `Efek gambar: ${desc}`, usage, cooldown: 5, limit: 1, effect: fn,
    async run(ctx) { const img = await loadImage(ctx); await fn(img, ctx.args); await ctx.sendFile({ buffer: await img.getBuffer('image/png'), mime: 'image/png' }, { caption: `✅ ${name}` }); }
  })),
  feature({ id: 'image.mirror', name: 'mirror', aliases: ['mirrorimg'], category: 'image', description: 'Cermin gambar: .mirror kiri/kanan/atas/bawah (reply gambar)', usage: '<kiri|kanan|atas|bawah>', cooldown: 5, limit: 1,
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
    } }),
  feature({ id: 'image.crop', name: 'crop', category: 'image', description: 'Potong gambar ke rasio: .crop 1:1 / 16:9 / 9:16 / 4:3 / 3:4 (reply gambar)', usage: '<rasio>', cooldown: 5, limit: 1,
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
    } }),
  feature({ id: 'image.info', name: 'imageinfo', aliases: ['infogambar'], category: 'image', description: 'Info gambar: ukuran, resolusi, warna dominan rata-rata', cooldown: 3,
    async run(ctx) {
      const img = await loadImage(ctx);
      const { width: w, height: h, data } = img.bitmap;
      let r = 0, g = 0, b = 0; const step = Math.max(4, Math.floor(data.length / 4 / 5000) * 4);
      let n = 0; for (let i = 0; i < data.length; i += step) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
      const hex = '#' + [r, g, b].map(x => Math.round(x / n).toString(16).padStart(2, '0')).join('').toUpperCase();
      await ctx.reply(`🖼️ Resolusi: ${w}×${h} (${(w * h / 1e6).toFixed(2)} MP)\nRasio: ${(w / h).toFixed(3)}\nWarna rata-rata: ${hex}`);
    } })
];
module.exports.EFFECTS = EFFECTS;
