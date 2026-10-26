'use strict';
const path = require('path');
const { DIR, I, NABI } = require('../../lib/islamic');

module.exports = I({ id: 'islamic.kisahnabi', name: 'kisahnabi', category: 'islamic', description: 'Kisah 25 nabi: .kisahnabi <nama>', usage: '<nama nabi>', cooldown: 5,
  async run(ctx) {
    const n = ctx.text.toLowerCase().replace(/^nabi\s+/, '').replace(/[^a-z]/g, '');
    if (!NABI.includes(n)) return ctx.reply(`Nama nabi: ${NABI.join(', ')}`);
    const d = require(path.join(DIR, 'kisah_nabi', `${n}.json`));
    const x = Array.isArray(d) ? d[0] : d;
    await ctx.reply(`📜 *${x.name}*\nTahun lahir (menurut dataset): ${x.thn_kelahiran} · Usia: ${x.usia} tahun · Tempat: ${x.tmp || '-'}\n\n${String(x.description).slice(0, 6000)}`);
  } });
