'use strict';
// Daftar file plugin per kategori (lihat saja; menulis/menghapus kode lewat chat tidak tersedia).
const fs = require('fs');
const path = require('path');
const { O } = require('../../lib/owner');

const DIR = path.join(__dirname, '..');

module.exports = O({ id: 'owner.listplugin', name: 'listplugin', aliases: ['listplugins'], description: 'Daftar file plugin bot per kategori', usage: '[kategori]',
  async run(ctx) {
    const cats = fs.readdirSync(DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
    const want = (ctx.args[0] || '').toLowerCase();
    if (want && cats.includes(want)) {
      const files = fs.readdirSync(path.join(DIR, want)).filter(f => f.endsWith('.js')).sort();
      return ctx.reply(`📂 *plugins/${want}* (${files.length})\n${files.map(f => `◦ ${f}`).join('\n')}\n\nAmbil: ${ctx.prefix}getplugin ${want}/<nama>`);
    }
    const rows = cats.map(c => `◦ ${c} (${fs.readdirSync(path.join(DIR, c)).filter(f => f.endsWith('.js')).length})`);
    await ctx.reply(`📂 *Plugin* — ${rows.length} kategori\n${rows.join('\n')}\n\nLihat isi: ${ctx.prefix}listplugin <kategori>`);
  } });
