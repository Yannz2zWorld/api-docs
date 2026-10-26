'use strict';
const { feature } = require('../../library/plugin-kit');
const { statusOpts } = require('../../lib/core');

module.exports = feature({ id: 'core.cmdinfo', name: 'cmdinfo', aliases: ['caracmd', 'infofitur'], category: 'core', description: 'Detail sebuah command: deskripsi, alias, parameter, permission, status', usage: '<command>',
  async run(ctx) {
    const name = ctx.requireText().replace(/^[./!#]/, '').split(/\s+/)[0];
    const f = ctx.yannajah.registry.resolve(name);
    if (!f) return ctx.reply(`Command *${name}* tidak ditemukan.`);
    const st = ctx.yannajah.registry.effectiveStatus(f, statusOpts(ctx));
    await ctx.reply([`*${ctx.prefix}${f.name}* ${f.usage || ''}`, f.description, `ID: ${f.id}`, `Kategori: ${f.category}`, `Alias: ${f.aliases.join(', ') || '-'}`, `Permission: ${f.permission}${f.scope !== 'all' ? ` (${f.scope} saja)` : ''}`, `Status: ${st}`, f.dependencies.apiz2z ? `API: APIZ2Z ${f.dependencies.apiz2z}` : null, f.params.length ? `Parameter: ${f.params.map(p => p.name + (p.required ? '*' : '')).join(', ')}` : null].filter(Boolean).join('\n'));
  } });
