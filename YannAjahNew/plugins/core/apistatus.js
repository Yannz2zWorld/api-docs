'use strict';
const { feature } = require('../../library/plugin-kit');

module.exports = feature({ id: 'core.apistatus', name: 'apistatus', category: 'core', description: 'Status koneksi ke APIZ2Z (tanpa memakai kuota)', permission: 'owner', cooldown: 10,
  async run(ctx) {
    const s = await ctx.api.getStatus();
    await ctx.reply([`APIZ2Z: ${s.reachable ? '✅ terjangkau' : `❌ tidak terjangkau (${s.error || s.status})`} ${s.ms} ms`, `API key: ${s.hasKey ? 'terisi' : 'BELUM diisi'}`, `Endpoint terverifikasi: ${s.endpoints}`, `Request: ${s.stats.requests} (ok ${s.stats.ok}, gagal ${s.stats.failed}, cache ${s.stats.cached})`].join('\n'));
  } });
