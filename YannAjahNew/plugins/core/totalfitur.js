'use strict';
const { feature } = require('../../library/plugin-kit');
const { statusOpts } = require('../../lib/core');

module.exports = feature({ id: 'core.totalfitur', name: 'totalfitur', aliases: ['fitur'], category: 'core', description: 'Jumlah fitur per status dan kategori (sesuai registry)',
  async run(ctx) {
    const reg = ctx.yannajah.registry; const count = {}; const cat = {};
    for (const f of reg.features.values()) { const s = reg.effectiveStatus(f, statusOpts(ctx)); count[s] = (count[s] || 0) + 1; if (s !== 'planned') cat[f.category] = (cat[f.category] || 0) + 1; }
    await ctx.reply(`📊 *Total fitur terdaftar: ${reg.features.size}*\n${Object.entries(count).map(([k, v]) => `• ${k}: ${v}`).join('\n')}\n\n*Per kategori (aktif):*\n${Object.entries(cat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${k}: ${v}`).join('\n')}`);
  } });
