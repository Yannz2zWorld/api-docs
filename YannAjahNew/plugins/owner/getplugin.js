'use strict';
const fs = require('fs');
const path = require('path');
const { UsageError } = require('../../library/errors');
const { O } = require('../../lib/owner');

const DIR = path.join(__dirname, '..');

module.exports = O({ id: 'owner.getplugin', name: 'getplugin', aliases: ['getplugins', 'getp'], description: 'Kirim file plugin sebagai dokumen: .getplugin game/tebakkata atau .getplugin tebakkata', usage: '<kategori/nama | nama>',
  async run(ctx) {
    const q = String(ctx.args[0] || '').toLowerCase().replace(/\.js$/, '');
    if (!/^[a-z0-9_-]+(\/[a-z0-9_-]+)?$/.test(q)) throw new UsageError(ctx.usage());
    let rel = q.includes('/') ? `${q}.js` : null;
    if (!rel) {
      const f = ctx.yannajah.plugins.get(q)?.file;   // relatif ke root bot: plugins/<kategori>/<nama>.js
      if (f && /^plugins[\\/]/.test(f)) rel = path.relative('plugins', f);
      else for (const c of fs.readdirSync(DIR)) if (fs.existsSync(path.join(DIR, c, `${q}.js`))) { rel = `${c}/${q}.js`; break; }
    }
    const abs = rel && path.resolve(DIR, rel);
    if (!abs || !abs.startsWith(DIR + path.sep) || !fs.existsSync(abs)) throw new UsageError(`Plugin "${q}" tidak ditemukan. Cek ${ctx.prefix}listplugin`);
    await ctx.sendFile({ buffer: fs.readFileSync(abs), mime: 'text/javascript' }, { asDocument: true, fileName: path.basename(abs), caption: `乂 *Get Plugin*\n◦ plugins/${path.relative(DIR, abs)}` });
  } });
