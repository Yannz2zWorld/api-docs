'use strict';
const { A } = require('../../lib/group-activity');

module.exports = A({ id: 'group.autolevel', name: 'autolevel', aliases: ['autolv'], description: 'Umumkan member naik level: on/off/set <pesan> (@user @level @xp)', usage: 'on/off/set <pesan>',
  async run(ctx) {
    const a = (ctx.args[0] || '').toLowerCase();
    if (a === 'set') { ctx.group.autolevelText = ctx.args.slice(1).join(' ').slice(0, 500) || null; ctx.db.touch(); return ctx.reply('✅ Pesan naik level disimpan.'); }
    if (!['on', 'off'].includes(a)) return ctx.reply(`╭一緒 *Auto Level*\n│୭ ˚.ᵎᵎ Status : ${ctx.group.autolevel ? '✅ AKTIF' : '❌ NONAKTIF'}\n│୭ ˚.ᵎᵎ ${ctx.prefix}autolevel on/off\n│୭ ˚.ᵎᵎ ${ctx.prefix}autolevel set <pesan>\n│୭ ˚.ᵎᵎ Variabel: @user @level @xp\n╰─────────一緒`);
    ctx.group.autolevel = a === 'on'; ctx.db.touch(); await ctx.reply(`✅ Auto level ${a === 'on' ? 'diaktifkan' : 'dimatikan'}.`);
  } });
