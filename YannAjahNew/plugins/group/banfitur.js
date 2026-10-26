'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

module.exports = feature({ id: 'group.banfitur', name: 'banfitur', category: 'group', scope: 'group', permission: 'admin', description: 'Larang command tertentu di grup ini: .banfitur <cmd> | .banfitur del <cmd> | .banfitur', usage: '[del] <command>',
  async run(ctx) {
    const g = ctx.group; g.bannedFeatures = Array.isArray(g.bannedFeatures) ? g.bannedFeatures : [];
    if (!ctx.args.length) return ctx.reply(`🚫 *BANNED FEATURES*\n\n${g.bannedFeatures.length ? g.bannedFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n') : '❌ Tidak ada'}\n\n${ctx.prefix}banfitur <cmd>\n${ctx.prefix}banfitur del <cmd>`);
    const del = ['del', 'hapus', 'unban'].includes(ctx.args[0].toLowerCase());
    const f = ctx.yannajah.registry.resolve((del ? ctx.args[1] : ctx.args[0]) || '');
    if (!f) throw new UsageError('Command tidak ditemukan.');
    if (['banfitur', 'menu'].includes(f.name) || f.category === 'owner') throw new UsageError('Command itu tidak bisa dilarang.');
    g.bannedFeatures = g.bannedFeatures.filter(x => x !== f.name); if (!del) g.bannedFeatures.push(f.name);
    ctx.db.touch(); await ctx.reply(del ? `✅ ${f.name} boleh dipakai lagi.` : `🚫 ${f.name} dilarang di grup ini.`);
  } });
