'use strict';
// Perbesar resolusi gambar lewat APIZ2Z (seperti .imageupscaler Lena AI). Cadangan berurutan:
// /api/tools/upscale -> /api/tools/upscale-v3 -> /api/tools/upscale-v2.
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const { callFirst, sendResult } = require('./apiz2z-kit');

const parseScale = arg => {
  const s = String(arg || '').trim().toLowerCase();
  if (!s) return 4;
  if (s === '2' || s === '2x') return 2;
  if (s === '4' || s === '4x') return 4;
  throw new UsageError('Skala hanya 2x atau 4x.');
};

// fixed = skala tetap (upscale2x / upscale4x); tanpa fixed, skala dari argumen (default 4x).
function upscaleFeature({ name, aliases = [], fixed = null }) {
  return feature({
    id: `tools.${name}`, name, aliases, category: 'tools', limit: 1, cooldown: 10,
    description: fixed ? `Perbesar resolusi gambar ${fixed}x (kirim/reply gambar)` : 'Perbesar resolusi gambar 2x/4x (kirim/reply gambar, default 4x)',
    usage: fixed ? '' : '[2x|4x]',
    params: fixed ? [] : [{ name: 'skala', required: false, description: '2x atau 4x' }],
    dependencies: { apiz2z: '/api/tools/upscale' },
    async run(ctx) {
      const md = ctx.media();
      if (!md || !/^image\//.test(md.mime)) throw new UsageError(`Kirim atau reply gambar dengan caption ${ctx.prefix}${ctx.command}${fixed ? '' : ' [2x|4x]'}`);
      const scale = fixed || parseScale(ctx.args[0]);
      await ctx.react('⏳');
      const file = { buffer: await md.download(), mime: md.mime };
      const { result } = await callFirst(ctx, [
        ['/api/tools/upscale', { factor: String(scale) }, file],
        ['/api/tools/upscale-v3', { resolusi: String(scale) }, file],
        ['/api/tools/upscale-v2', {}, file]
      ]);
      await sendResult(ctx, result, { title: 'Image Upscaler', category: 'tools', caption: `乂 *Image Upscaler*\n◦ Skala : ${scale}x` });
      await ctx.react('✅');
    }
  });
}

module.exports = { upscaleFeature, parseScale };
